---
area: fiscal-notes
type: flow
status: current
related:
  - ../concepts/input-and-provider-strategy.md
  - ../decisions/reusable-redis-circuit-breaker.md
  - ../reference/http-and-error-contracts.md
  - ../reference/redis-keys-and-limits.md
---

# Preview and Resilience

O fluxo de pré-visualização (`POST /fiscal-notes/preview`) resolve os dados estruturados da NFC-e a partir de cache ou consulta à SEFAZ, verifica se o usuário já importou a nota e retorna a sugestão de transação sem persistir nada no PostgreSQL. A mesma camada de resolução e resiliência (`FiscalNoteQueryService.resolve`) é reutilizada pelas etapas de `import` e `link`.

## Gatilho e Pré-condições

- **Gatilho:** Requisição HTTP autenticada em `POST /fiscal-notes/preview` (ou `import` / `link` antes da abertura de transação no banco).
- **Pré-condições:** Usuário autenticado com e-mail verificado (`OriginGuard` -> `JwtAuthGuard` -> `EmailVerificationStatusGuard`), dentro do limite HTTP de `10 req / 60s` (`ThrottlerGuard` por rota).

## Passo a Passo Observável

1. **Validação Local (`FiscalNoteInput.parse`):** Valida formato, payload QR v2/v3 ou chave 44d, modelo `65`, dígito verificador mod-11, ambiente de produção (`'1'`) e UF suportada (`'23'`). Se `unknownQrHost` estiver presente, registra log `warn` (`FISCAL_NOTE_UNKNOWN_QR_HOST`) e dispara alerta `WARN` (`fiscal-notes:qr:unknown-host:{uf}`, com o `host` preservado em `metadata` e `summary`).
2. **Consulta ao Cache Redis (`IFiscalNoteCache`):** Lê `fiscal-notes:parsed:v1:{accessKey}`.
   - **Cache Hit:** Incrementa métrica `fiscal_notes.cache.lookup.total` (`result: 'hit'`) e retorna imediatamente os dados sanitizados (`cacheHit: true`), **contornando** Circuit Breaker e rate limiters de SEFAZ.
   - **Cache Miss:** Incrementa `fiscal_notes.cache.lookup.total` (`result: 'miss'`) e avança para os portões de proteção externa.
3. **Verificação do Circuit Breaker (`CircuitBreakerService.canExecute`):** Consulta `fiscal-notes:cb:v1:{uf}`:
   - Se `OPEN` dentro do cooldown (`now < nextAttemptAtMs`), falha rápido com `503 SEFAZ_TEMPORARILY_UNAVAILABLE` e header `Retry-After` (sem chamar rate limiter nem SEFAZ).
   - Se `OPEN` com cooldown vencido, tenta adquirir lock de sonda única `fiscal-notes:cb:v1:{uf}:probe` (`SET NX EX <probeLockTtlSeconds>`), com `probeLockTtlSeconds` dimensionado por `FiscalNoteQueryService` pela janela máxima de timeout + retry (`ceil((timeoutMs * (maxRetries + 1) + retryBackoffMs * maxRetries) / 1000) + 5s`, `20s` no default e até `38s` no pior caso); quem adquire promove o circuito para `HALF_OPEN` e executa 1 sonda controlada, enquanto requisições concorrentes recebem `503`.
4. **Rate Limiter de Cache Miss em 2 Camadas (`RedisFiscalNoteRateLimiter`):** Executa scripts Lua atômicos no Redis na seguinte ordem:
   - **Camada 2A (Usuário):** Verifica `fiscal-notes:rl:sefaz:user:{userId}:1m` (padrão `5/min`) e `fiscal-notes:rl:sefaz:user:{userId}:1h` (padrão `30/h`). Se excedido, lança `429 FISCAL_NOTE_RATE_LIMIT_EXCEEDED` com `Retry-After` **sem consumir a cota global da UF**.
   - **Camada 2B (Global da VPS por UF):** Verifica `fiscal-notes:rl:sefaz:global:{uf}:1m` (padrão `40/min`). Se excedido, emite log `warn` + alerta `WARN` (`FISCAL_NOTE_SEFAZ_GLOBAL_RL_HIT`) e lança `503 SEFAZ_TEMPORARILY_UNAVAILABLE` com `Retry-After`.
   - **Liberação de Sonda `HALF_OPEN`:** Se qualquer camada rejeitar uma requisição que havia recebido sonda `HALF_OPEN` no passo 3, `FiscalNoteQueryService` chama `circuitBreaker.releaseProbe(cbOptions)`, removendo `:probe` e restaurando o estado para `OPEN` (preservando `consecutiveFailures`, `cooldownStage`, `openedAtMs` e `nextAttemptAtMs` já expirados) para que o próximo usuário elegível possa sondar imediatamente sem esperar o TTL do lock (`20s`–`38s`).
5. **Chamada HTTP ao Provedor (`SefazCeHttpClient`):** Envia `POST` para o endpoint allowlisted (`qrcodev2` ou `qrcodev3`) com `redirect: 'error'`, timeout configurável (padrão `7000 ms`) e limite rígido de **1 MB** (`1_048_576` bytes) checado em `Content-Length` e por streaming de chunks. Em falha transitória (timeout, erro de rede ou HTTP `502`/`503`/`504`), executa no máximo **1 retry** após `400 ms` (padrão).
6. **Parsing Sanitizado (`SefazCeHtmlParser`):**
   - Se a resposta `200` trouxer `{ "erro": ... }`, decodifica entidades HTML malformadas (ex.: `&aacute`) com `cheerio/slim` e lança erro de negócio (`404 FISCAL_NOTE_SEFAZ_NOT_FOUND`, `422 FISCAL_NOTE_CANCELLED_OR_DENIED` ou `422 FISCAL_NOTE_HOMOLOGATION_NOT_ALLOWED`).
   - Se trouxer `{ "xml": "<HTML>" }`, remove seções `Consumidor`, valida ausência de banners de cancelamento/homologação, extrai cabeçalho/itens/totais/pagamentos (`NaN` no troco -> `null`) e valida integridade (chave extraída == solicitada, CNPJ 14d, >= 1 item, tolerância de 1 centavo).
7. **Atualização do Circuit Breaker, Cache e Métricas:**
   - **Sucesso ou Erro de Negócio da SEFAZ:** Chama `circuitBreaker.recordSuccess` (em `CLOSED`, zera a contagem de falhas consecutivas quando `consecutiveFailures > 0`; se transitou `HALF_OPEN -> CLOSED`, emite log `FISCAL_NOTE_SEFAZ_CB_CLOSED` e alerta `RESOLVED`). Em sucesso, grava JSON sanitizado no Redis com TTL configurável (padrão `1200s`) e registra `fiscal_notes.sefaz.query.total` (`outcome: 'success'`) / `duration_ms`; em erro de negócio (`404`/`422`), não grava cache e registra `outcome: 'business_error'`.
8. **Checagem de Duplicidade e Resposta (`PreviewFiscalNoteUseCase`):** Consulta `findActiveByUserIdAndAccessKey(userId, accessKey)` no PostgreSQL, incrementa `fiscal_notes.operations.total` (`operation: 'preview'`) e retorna `fiscal_note.preview` com `alreadyImported`, `existingTransactionId`, `existingFiscalNoteId`, `cacheHit` e `suggestedTransaction` (`EXPENSE`, `EFFECTIVE`, `payableAmountCents`, `issuedDate`, `issuerName` truncado ao limite de descrição).

## Idempotência e Comportamento em Repetição

- `POST /fiscal-notes/preview` é **somente leitura** sobre o PostgreSQL e seguro para repetições pelo frontend.
- Repetições dentro do TTL do cache (`1200s` por padrão) retornam `cacheHit: true` sem consumir cota na SEFAZ, mesmo que o Circuit Breaker esteja `OPEN`.

## Tratamento de Falhas e Casos de Borda

| Cenário de Falha | Retry HTTP? | Afeta Circuit Breaker? | Observabilidade / Alerta | Resposta HTTP |
| --- | --- | --- | --- | --- |
| Input inválido, mod != `65`, mod-11 inválido | Não | Não | — | `400 FISCAL_NOTE_INVALID_INPUT` |
| Ambiente homologação (`2`) ou UF != `23` | Não | Não | — | `422 FISCAL_NOTE_HOMOLOGATION_NOT_ALLOWED` / `FISCAL_NOTE_UNSUPPORTED_UF` |
| Circuit Breaker `OPEN` ou sonda em andamento | Não | Mantém estado | Métrica `outcome: 'cb_open'` | `503 SEFAZ_TEMPORARILY_UNAVAILABLE` + `Retry-After` |
| Rate limit por usuário (1m ou 1h) | Não | Não (em `HALF_OPEN`, chama `releaseProbe`) | Métrica `outcome: 'rate_limited'` | `429 FISCAL_NOTE_RATE_LIMIT_EXCEEDED` + `Retry-After` |
| Rate limit global por UF (1m) | Não | Não (em `HALF_OPEN`, chama `releaseProbe`) | Log `warn` + Alerta `WARN` (`FISCAL_NOTE_SEFAZ_GLOBAL_RL_HIT`) | `503 SEFAZ_TEMPORARILY_UNAVAILABLE` + `Retry-After` |
| SEFAZ retornou `{ "erro": ... }` ou banner fiscal | Não | Chama `recordSuccess` (zera falhas em `CLOSED` e fecha o CB em `HALF_OPEN`; sem `recordFailure`) | Métrica `outcome: 'business_error'` (e alerta `RESOLVED` se fechar `HALF_OPEN`) | `404 FISCAL_NOTE_SEFAZ_NOT_FOUND` ou `422` |
| Timeout / erro de rede / HTTP `502`, `503`, `504` | Máx. 1 retry (`400ms`) | Sim (`recordFailure`) | Log `warn` (`FISCAL_NOTE_SEFAZ_REQUEST_FAILED`) + Alerta `CRITICAL` se abrir CB | `504 SEFAZ_TIMEOUT` ou `503 SEFAZ_TEMPORARILY_UNAVAILABLE` |
| Corpo `> 1 MB` (`Content-Length` ou stream) | Não | Sim (`recordFailure`) | Log `warn` + Alerta `CRITICAL` se abrir CB | `502 FISCAL_NOTE_RESPONSE_TOO_LARGE` |
| Falha estrutural ou de integridade no parser HTML | Não | Sim (`recordFailure`) | Log `error` + Alerta `CRITICAL` (`FISCAL_NOTE_SEFAZ_PARSER_FAILURE`) + CB | `502 FISCAL_NOTE_PARSE_FAILED` |
| Redis indisponível (cache, rate limit ou CB) | — | Fail-open | Log `warn` (`*_REDIS_ERROR`) | Degrada com segurança sem derrubar a requisição |
