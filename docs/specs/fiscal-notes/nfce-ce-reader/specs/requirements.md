---
area: fiscal-notes
type: spec-requirements
status: approved
issue: 144
---

# Requirements — Leitura e Importação de NFC-e (SEFAZ-CE)

## 1. Objetivo

Permitir que usuários autenticados da Danfy leiam uma **NFC-e** (Nota Fiscal de Consumidor Eletrônica) a partir do **QR Code** (payload/URL completo) ou da **chave de acesso de 44 dígitos** (fallback), consultem os dados fiscais na **SEFAZ-CE** (`UF = 23`), visualizem uma prévia estruturada dos dados da nota e persistam a nota fiscal completa (**cabeçalho + itens + meios de pagamento**) vinculada a uma transação de **despesa (`EXPENSE`)**, tanto criando uma nova despesa quanto vinculando a uma despesa existente.

## 2. Contexto e Documentos de Origem

- GitHub Issue: `#144` — `[FISCAL-NOTES] Permitir leitura e importação de NFC-e (SEFAZ-CE) vinculada a despesas com itens persistidos`
- Especificação de produto no Notion: `Leitor de NF` (29 decisões fechadas)
- Pesquisa técnica de integração no Notion: `Pesquisa SEFAZ-CE — API da NFC-e`
- Pré-requisito concluído: Issue `#143` / PR `#145` (fundação transversal de observabilidade: logs estruturados, `IMetricsRecorder`, `OperationalAlertService`)
- Referências no repositório:
  - `docs/architecture/module-boundaries.md`
  - `docs/platform/observability/README.md`
  - `docs/platform/response-objects/README.md`
  - `api/src/modules/transactions/`
  - `api/src/common/filters/app-exception.filter.ts`
  - `api/src/common/utils/cache-keys.factory.ts`

## 3. Escopo (In Scope)

1. Novo módulo dedicado `api/src/modules/fiscal-notes/` em Clean Architecture + DDD, com arquitetura extensível por UF (`IFiscalNoteProvider` + registry) e provedor V1 **SEFAZ-CE (`UF = 23`)**.
2. Componente reutilizável de **Circuit Breaker distribuído no Redis** em `api/src/shared/circuit-breaker/`.
3. Migration aditiva (`expand`-only, compatível com deploy `N`/`N+1`) criando `fiscal_notes`, `fiscal_note_items` e `fiscal_note_payments` em PostgreSQL (3NF).
4. Fluxo completo em 2 etapas e consulta de histórico via HTTP autenticado:
   - `GET /fiscal-notes` — listagem paginada das notas fiscais ativas do usuário com filtros (`issuedFrom`, `issuedTo`, `issuerCnpj`, `sourceUf`, `minAmountCents`, `maxAmountCents`, `search`), ordenação allowlisted, itens leves com `itemsCount`, `meta` e `summary` agregado do recorte;
   - `GET /fiscal-notes/:id` — consulta direta de uma nota fiscal ativa por ID com cabeçalho, itens e pagamentos ordenados;
   - `POST /fiscal-notes/preview` — validação local, cache Redis, consulta SEFAZ-CE (em cache miss), parsing sanitizado, retorno da prévia + status de duplicidade + sugestões para criação da despesa;
   - `POST /fiscal-notes/import` — criação atômica de nova `Transaction (EXPENSE)` + `FiscalNote` + itens + pagamentos;
   - `POST /transactions/:transactionId/fiscal-note` — vínculo de `FiscalNote` a uma `Transaction (EXPENSE)` já existente (sem sobrescrever campos da transação);
   - `GET /transactions/:transactionId/fiscal-note` — consulta da nota fiscal ativa da transação com itens e pagamentos ordenados;
   - `DELETE /transactions/:transactionId/fiscal-note` — desvínculo/remoção lógica independente da nota fiscal (mantendo a transação intacta).
5. Integração controlada com o módulo `transactions`:
   - Campo leve `hasFiscalNote: boolean` em `TransactionResponseDto` (listagem paginada e detalhe/edição/confirmação) sem embutir itens/pagamentos;
   - Soft delete sincronizado em `DeleteTransactionUseCase`: deletar uma transação realiza soft delete da `FiscalNote` ativa na mesma transação PostgreSQL;
   - Bloqueio de mudança de `type` de `EXPENSE` para outro tipo em `UpdateTransactionUseCase` e `ConfirmTransactionUseCase` enquanto existir `FiscalNote` ativa vinculada.
6. Proteções de segurança, LGPD/Zero-PII, resiliência e observabilidade:
   - Proteção anti-SSRF (nunca requisitar URL enviada pelo cliente; allowlist fixa por UF + alerta `WARN` se host desconhecido);
   - Descarte completo do bloco `Consumidor` e não persistência de HTML bruto (PostgreSQL, Redis e logs);
   - Rate limit em 2 camadas (HTTP `@Throttle` + Redis cache-miss por usuário e global da VPS por UF);
   - Timeout curto, limite estrito de 1 MB na resposta HTTP, 1 retry transitório controlado e Circuit Breaker com cooldown progressivo;
   - Métricas leves (`IMetricsRecorder`) e alertas operacionais no Telegram (`OperationalAlertService`), sem tocar em `/health`.
7. Documentação viva (`docs/fiscal-notes/`, `docs/database/schema.md`, `docs/configuration.md`, `docs/errors/`, `docs/integrations/`, `docs/tests/`, `api/src/modules/fiscal-notes/AGENTS.md`) e suíte completa de testes unitários, E2E e integração (Testcontainers PostgreSQL + Redis).

## 4. Fora de Escopo (Out of Scope)

- Suporte a outras UFs além do Ceará (`UF = 23`) na V1 (apenas a abstração de registry por UF entra agora).
- Processamento assíncrono em fila BullMQ para consulta/importação de notas na V1.
- Edição manual de itens, pagamentos ou cabeçalho da `FiscalNote` após persistência (V1 é read-only).
- Rateio/split automático da despesa entre múltiplas contas a partir de múltiplos pagamentos da NFC-e.
- Catálogo normalizado de produtos, comparação histórica de preços ou sugestões automáticas de categoria por item.
- OCR de foto/PDF de cupom fiscal.
- Persistência de XML/HTML bruto em banco ou Object Storage (R2).
- Alterações no contrato de `/health` ou adição de indicadores de SEFAZ/Telegram em health checks.

## 5. Requisitos Funcionais

### RF-01 — Entrada e Validação Local (QR Code e Chave de 44 Dígitos)
- O sistema deve aceitar em `input` (string não vazia, máx. 1024 caracteres):
  - **Payload/URL completo do QR Code** (fluxo principal), suportando:
    - QR Code v2 emissão normal (`?p=chave|2|amb|idCSC|hash`, 5 campos);
    - QR Code v2 emissão em contingência `tpEmis = 9` (`?p=chave|2|amb|dia|valor|digVal|idCSC|hash`, 8 campos);
    - QR Code v3 (`?p=chave|3|amb`, 3 campos);
    - Payload `p` direto sem prefixo de URL (ex.: `232610...|2|1|1|HASH`).
  - **Chave de acesso de 44 dígitos** (fallback manual), tolerando espaços, hífens ou pontuação que serão removidos na normalização.
- A validação local deve rejeitar antes de qualquer chamada externa (ou acesso a cache/rate limit de SEFAZ):
  - entrada vazia, malformada ou chave que não contenha exatamente 44 dígitos numéricos (`400 FISCAL_NOTE_INVALID_INPUT`);
  - modelo fiscal (posições 21–22, 1-indexed) diferente de `65` (NFC-e) (`400 FISCAL_NOTE_INVALID_INPUT`);
  - dígito verificador (posição 44) inválido segundo cálculo **módulo 11** oficial da NF-e/NFC-e (`400 FISCAL_NOTE_INVALID_INPUT`);
  - ambiente de homologação (`tipo_ambiente = 2` no payload do QR Code) (`422 FISCAL_NOTE_HOMOLOGATION_NOT_ALLOWED`);
  - UF (posições 1–2 da chave) sem provedor registrado na V1 (qualquer UF ≠ `23`) (`422 FISCAL_NOTE_UNSUPPORTED_UF`).
- Se a entrada for uma URL válida cujo `hostname` não pertence à allowlist conhecida da UF (`nfce.sefaz.ce.gov.br`), o sistema **nunca** requisita a URL fornecida: extrai apenas o parâmetro `p` localmente, registra log `warn` e emite alerta operacional `WARN` (`FISCAL_NOTE_UNKNOWN_QR_HOST`) com cooldown, prosseguindo a consulta exclusivamente no endpoint fixo da SEFAZ-CE.

### RF-02 — Consulta SEFAZ-CE e Parsing Estruturado
- Para `UF = 23` (Ceará), o `SefazCeProvider` deve chamar exclusivamente os endpoints hardcoded de `http://nfce.sefaz.ce.gov.br`:
  - `POST /nfce/api/notasFiscal/qrcodev2/` quando o input trouxer payload completo de QR Code v2 (5 ou 8 campos);
  - `POST /nfce/api/notasFiscal/qrcodev3/` quando o input for chave de 44 dígitos (fallback) ou QR Code v3 (`versao_qrcode = "3"`), sempre com `tipo_ambiente = "1"`.
- A resposta HTTP `200` com JSON `{ "erro": "..." }` deve ser classificada como erro de negócio da SEFAZ (sem retry e sem abrir Circuit Breaker):
  - decodificar entidades HTML malformadas presentes na mensagem (ex.: `&aacute` sem ponto e vírgula);
  - erro de nota inexistente / QR inválido (`100`, "não encontrada", etc.) → `404 FISCAL_NOTE_SEFAZ_NOT_FOUND`;
  - erro de nota cancelada / denegada → `422 FISCAL_NOTE_CANCELLED_OR_DENIED`;
  - erro de ambiente homologação → `422 FISCAL_NOTE_HOMOLOGATION_NOT_ALLOWED`.
- A resposta HTTP `200` com `{ "xml": "<HTML>" }` deve ser parseada de forma determinística:
  - detectar banners/textos de nota cancelada, denegada ou emitida em homologação no HTML e rejeitar (`422 FISCAL_NOTE_CANCELLED_OR_DENIED` ou `422 FISCAL_NOTE_HOMOLOGATION_NOT_ALLOWED`);
  - extrair cabeçalho: `issuerName`, `issuerCnpj` (14 dígitos numéricos), `issuerAddress`, `number`, `series`, `issuedAt` (instante UTC preciso preservando fuso `-03:00` / `America/Fortaleza`), `issuedDate` (`YYYY-MM-DD` civil local da emissão), `protocol`, `xmlVersion`, `xsltVersion`;
  - extrair totais em centavos inteiros seguros: `grossAmountCents`, `discountAmountCents` (default `0` quando ausente), `payableAmountCents`, `taxAmountCents` (default `0` quando ausente), `changeAmountCents` (`null` quando ausente ou literal `NaN` da SEFAZ-CE);
  - extrair lista ordenada de `items` (`position` 1..N, `rawDescription`, `storeCode`, `unit`, `quantity`, `unitPrice`, `totalPriceCents`);
  - extrair lista ordenada de `payments` (`position` 1..N, `methodLabel`, `amountCents`);
  - descartar completamente qualquer dado do bloco `Consumidor` (CPF/CNPJ, nome, endereço do comprador);
  - validar integridade mínima do parsing:
    - chave de acesso extraída do HTML (`span.chave`, apenas dígitos) igual à `accessKey` solicitada;
    - `issuerName` não vazio e `issuerCnpj` com 14 dígitos;
    - pelo menos 1 item válido (`quantity > 0`, `unitPrice >= 0`, `totalPriceCents >= 0`);
    - valores monetários não negativos e inteiros seguros;
    - consistência aritmética com tolerância de 1 centavo: `|((grossAmountCents - discountAmountCents) - payableAmountCents)| <= 1`.
  - Qualquer falha estrutural ou de integridade do parsing deve disparar `502 FISCAL_NOTE_PARSE_FAILED`, registrar falha no Circuit Breaker e emitir alerta `CRITICAL` (`FISCAL_NOTE_SEFAZ_PARSER_FAILURE`).

### RF-03 — Preview (`POST /fiscal-notes/preview`)
- Deve validar o input localmente, verificar duplicidade ativa `(userId, accessKey)` no PostgreSQL e buscar a nota parseada:
  - primeiro no cache Redis (`fiscal-notes:parsed:v1:{accessKey}`);
  - em cache miss: verificar Circuit Breaker → verificar rate limits de SEFAZ (usuário + global UF) → consultar SEFAZ → parsear → gravar resultado sanitizado no Redis com TTL configurável (padrão 20 min / 1200s, faixa 15–30 min).
- Deve retornar `200 OK` com:
  - `object: 'fiscal_note.preview'`;
  - `alreadyImported: boolean`, `existingTransactionId: string | null`, `existingFiscalNoteId: string | null`;
  - `cacheHit: boolean`;
  - `suggestedTransaction`: `{ type: 'EXPENSE', status: 'EFFECTIVE', amountCents: payableAmountCents, date: issuedDate, description: normalizedIssuerName }`;
  - `fiscalNote`: dados estruturados da nota parseada + `items` + `payments` (sem qualquer dado de consumidor).
- Em cache hit, a requisição deve funcionar mesmo que o Circuit Breaker da SEFAZ esteja aberto ou o rate limit de SEFAZ tenha sido atingido (respeitando apenas o throttle HTTP da rota).

### RF-04 — Importação Criando Nova Despesa (`POST /fiscal-notes/import`)
- Recebe `input`, `accountId`, `categoryId` e overrides opcionais (`amountCents`, `date`, `description`, `status`).
- Obtém a nota parseada do cache Redis ou, em caso de cache miss/expiração, reconsulta a SEFAZ aplicando todas as mesmas proteções (nunca confia em itens/totais enviados pelo cliente).
- Valida se `amountCents` efetivo (`override ?? parsed.payableAmountCents`) é inteiro positivo dentro dos limites de `Transaction` (caso a nota tenha `payableAmountCents === 0` e não haja override positivo, falha com `400 INVALID_TRANSACTION`).
- Em uma transação curta PostgreSQL (após a consulta externa, nunca mantendo transação aberta durante I/O HTTP):
  1. verifica duplicidade ativa `(userId, accessKey)` → se existir, falha com `409 FISCAL_NOTE_ALREADY_IMPORTED` contendo `details: { existingTransactionId, existingFiscalNoteId }`;
  2. delega ao port de `transactions` a criação da transação com `type = EXPENSE` (lock de conta, validação de conta ativa e categoria compatível com `EXPENSE`, `status = override ?? EFFECTIVE`, `date = override ?? issuedDate`, `description = override ?? normalizedIssuerName`);
  3. persiste `FiscalNote` + `FiscalNoteItem[]` + `FiscalNotePayment[]` vinculados à transação criada;
  4. trata race condition de unique violation (`23505`) nos índices parciais convertendo em `409 FISCAL_NOTE_ALREADY_IMPORTED` com `details`.
- Retorna `201 Created` com `object: 'fiscal_note.import'`, `transaction` (com `hasFiscalNote: true`) e `fiscalNote` (com itens e pagamentos).

### RF-05 — Vínculo a Despesa Existente (`POST /transactions/:transactionId/fiscal-note`)
- Recebe `transactionId` na rota e `input` no corpo.
- Obtém a nota parseada do cache Redis ou reconsulta SEFAZ em cache miss (antes de abrir transação no PostgreSQL).
- Em transação curta PostgreSQL:
  1. bloqueia a `Transaction` com `FOR UPDATE` validando ownership (`userId`) e `deleted_at IS NULL` → senão `404 TRANSACTION_NOT_FOUND`;
  2. valida que `transaction.type === EXPENSE` → senão `409 TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE`;
  3. valida que a transação ainda não possui `FiscalNote` ativa → senão `409 TRANSACTION_ALREADY_HAS_FISCAL_NOTE` com `details: { existingFiscalNoteId }`;
  4. valida que o usuário ainda não possui `FiscalNote` ativa com a mesma `accessKey` → senão `409 FISCAL_NOTE_ALREADY_IMPORTED` com `details: { existingTransactionId, existingFiscalNoteId }`;
  5. persiste `FiscalNote` + itens + pagamentos sem alterar nenhum campo da `Transaction` existente (`amountCents`, `date`, `description`, `accountId`, `categoryId`, `status` permanecem intactos);
  6. trata race condition `23505` nos dois índices parciais de unicidade convertendo nos respectivos erros `409`.
- Retorna `201 Created` com `FiscalNoteResponseDto` (`object: 'fiscal_note.item'`).

### RF-06 — Consulta e Desvínculo Independente de Nota Fiscal
- `GET /transactions/:transactionId/fiscal-note`:
  - valida que a transação existe, pertence ao usuário autenticado e não está deletada (`404 TRANSACTION_NOT_FOUND`);
  - retorna `200 OK` com `FiscalNoteResponseDto` (`object: 'fiscal_note.item'`) contendo cabeçalho, `items` ordenados por `position ASC` e `payments` ordenados por `position ASC`;
  - se a transação não possuir nota fiscal ativa vinculada, retorna `404 FISCAL_NOTE_NOT_FOUND`.
- `DELETE /transactions/:transactionId/fiscal-note`:
  - valida que a transação existe, pertence ao usuário autenticado e não está deletada (`404 TRANSACTION_NOT_FOUND`);
  - valida que existe `FiscalNote` ativa vinculada (`404 FISCAL_NOTE_NOT_FOUND`);
  - realiza soft delete (`deleted_at = now()`) apenas na `FiscalNote`, mantendo a `Transaction` intacta;
  - libera tanto a `Transaction` para receber outro vínculo quanto a `accessKey` para reimportação pelo usuário;
  - retorna `204 No Content`.

### RF-06B — Listagem Paginada (`GET /fiscal-notes`) e Detalhe Direto (`GET /fiscal-notes/:id`)
- `GET /fiscal-notes`:
  - lista apenas notas fiscais ativas (`deleted_at IS NULL`) pertencentes ao usuário autenticado (`@CurrentUser()`);
  - paginação: `page` (inteiro `>= 1`, padrão `1`) e `limit` (inteiro `1..100`, padrão `20`);
  - ordenação (`sort`, allowlist fechada com desempate determinístico por `id`):
    - `issuedAt:desc` *(padrão)*, `issuedAt:asc`;
    - `payableAmountCents:desc`, `payableAmountCents:asc`;
    - `createdAt:desc`, `createdAt:asc`;
  - filtros opcionais combináveis (AND):
    - `issuedFrom` / `issuedTo` (`DateOnly` `YYYY-MM-DD`, validando `issuedFrom <= issuedTo` — convertidos para limites `[início do dia em -03:00, início do dia seguinte em -03:00)` sem envolver `issued_at` em função SQL, preservando o uso de índice);
    - `issuerCnpj` (aceita 14 dígitos ou CNPJ com máscara `./-` e espaços normalizados para 14 dígitos; rejeita formatos inválidos com `400`);
    - `sourceUf` (2 dígitos numéricos, ex.: `23`);
    - `minAmountCents` / `maxAmountCents` (inteiros `>= 0` filtrando `payable_amount_cents`, validando `minAmountCents <= maxAmountCents`);
    - `search` (texto até 120 caracteres, trimado e com escape de `\`, `%` e `_`, case-insensitive): busca em `issuer_name` **ou** em `fiscal_note_items.raw_description` via `EXISTS` (sem duplicar linhas na paginação);
  - se `issuedFrom > issuedTo` ou `minAmountCents > maxAmountCents`, rejeitar com `400 FISCAL_NOTE_INVALID_INPUT`;
  - retorna `200 OK` com `ListFiscalNotesResponseDto` (`object: 'fiscal_note.list'`):
    - `data`: lista leve de `FiscalNoteSummaryResponseDto` (`object: 'fiscal_note.summary'`) sem arrays de itens/pagamentos: `id`, `transactionId`, `accessKey`, `sourceUf`, `number`, `series`, `issuedAt`, `issuerName`, `issuerCnpj`, `grossAmountCents`, `discountAmountCents`, `payableAmountCents`, `taxAmountCents`, `itemsCount`, `createdAt`, `updatedAt`;
    - `meta`: `{ total, page, limit, totalPages, hasNextPage, hasPreviousPage }`;
    - `summary`: agregados do recorte filtrado (`object: 'fiscal_note.summary_totals'`): `totalNotes`, `totalGrossAmountCents`, `totalDiscountAmountCents`, `totalPayableAmountCents`, `totalTaxAmountCents`.
- `GET /fiscal-notes/:id`:
  - valida UUID em `:id` e busca nota ativa filtrada por `(id, userId)` (proteção contra IDOR);
  - retorna `200 OK` com `FiscalNoteResponseDto` (`object: 'fiscal_note.item'`, cabeçalho + `items` + `payments` ordenados);
  - se não existir, estiver deletada ou pertencer a outro usuário, retorna `404 FISCAL_NOTE_NOT_FOUND`.

### RF-07 — Integração com o Ciclo de Vida de `transactions`
- `TransactionResponseDto` passa a incluir o campo booleano `hasFiscalNote: boolean`:
  - em `ListTransactionsUseCase`, preenchido via consulta em lote (`IN (...)`) sem gerar N+1;
  - em `GetTransactionUseCase`, `UpdateTransactionUseCase`, `ConfirmTransactionUseCase` e `CreateTransactionUseCase`, sempre coerente com o estado real da transação.
- `DeleteTransactionUseCase`:
  - ao realizar soft delete de uma transação, deve realizar soft delete (`deleted_at = now()`) de qualquer `FiscalNote` ativa vinculada a ela **dentro da mesma transação PostgreSQL**, liberando a `accessKey` para reimportação e preservando o histórico soft-deleted.
- `UpdateTransactionUseCase` e `ConfirmTransactionUseCase`:
  - se o patch tentar alterar `type` para um tipo diferente de `EXPENSE` enquanto houver `FiscalNote` ativa vinculada à transação, deve bloquear com `409 TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE`.
- Multi-tenancy:
  - usuários diferentes podem importar e vincular a mesma `accessKey` de forma totalmente independente;
  - nenhum endpoint permite ler, vincular ou desvincular nota fiscal de transação de outro usuário.

## 6. Requisitos Não Funcionais (Segurança, Resiliência, Observabilidade e Dados)

### RNF-01 — Proteção Anti-SSRF e Isolamento de `http://`
- O backend **nunca** executa requisições HTTP para URLs ou hosts fornecidos pelo usuário.
- O tráfego `http://` exigido pela SEFAZ-CE fica estritamente isolado no `SefazCeProvider`, direcionado exclusivamente à base URL allowlisted configurada (`http://nfce.sefaz.ce.gov.br` por padrão).

### RNF-02 — LGPD e Zero-PII
- HTML bruto da SEFAZ **nunca** é persistido no PostgreSQL, no Redis ou registrado em logs.
- Dados do bloco `Consumidor` (CPF/CNPJ, nome, endereço) **nunca** entram no objeto parseado, no cache Redis, nas tabelas do banco, nas respostas HTTP ou nos logs.
- Chaves de acesso completas, payloads de QR Code contendo `hash`/CSC e CNPJs não devem ser logados crus fora das políticas de redaction; logs estruturados devem usar prefixo/sufixo mascarado ou `uf` + `accessKeySuffix` (últimos 4 dígitos) quando necessário para depuração segura.

### RNF-03 — Rate Limiting em 2 Camadas
- **Camada 1 (HTTP):** `@Throttle` dedicado de `10 req / 60s` nas rotas de leitura/importação (`preview`, `import`, `link`).
- **Camada 2A (SEFAZ cache-miss por usuário no Redis):** `5 consultas / 1 min` (`fiscal-notes:rl:sefaz:user:{userId}:1m`) e `30 consultas / 1 hora` (`fiscal-notes:rl:sefaz:user:{userId}:1h`) → excedido retorna `429 FISCAL_NOTE_RATE_LIMIT_EXCEEDED` com header `Retry-After`.
- **Camada 2B (SEFAZ cache-miss global da VPS por UF no Redis):** `40 consultas / 1 min` (`fiscal-notes:rl:sefaz:global:{uf}:1m`) → excedido retorna `503 SEFAZ_TEMPORARILY_UNAVAILABLE` com header `Retry-After` e dispara alerta `WARN` (`FISCAL_NOTE_SEFAZ_GLOBAL_RL_HIT`).

### RNF-04 — Resiliência HTTP e Circuit Breaker Reutilizável no Redis
- Timeout HTTP na SEFAZ configurável (padrão `7000 ms`, faixa `6000–8000 ms`).
- Limite rígido de **1 MB** (`1_048_576` bytes) no tamanho da resposta HTTP: validado tanto via `Content-Length` quanto acumulando chunks do stream e abortando imediatamente se excedido (`502 FISCAL_NOTE_RESPONSE_TOO_LARGE`).
- Máximo de **1 retry** com backoff curto (`400 ms`, faixa `300–500 ms`) **somente** para falhas transitórias (timeout, erro de rede, HTTP `502`/`503`/`504`); zero retry para erros de negócio da SEFAZ (`{ "erro": ... }`), `4xx` ou falhas de parsing.
- **Circuit Breaker compartilhado (`api/src/shared/circuit-breaker/`)** persistido no Redis (chave `fiscal-notes:cb:v1:{uf}`):
  - abre após `N` falhas consecutivas de infraestrutura ou parsing (padrão `5`);
  - cooldown progressivo: `60s -> 120s -> 300s` (configurável);
  - estado `HALF_OPEN` após expiração do cooldown permite sonda controlada; sucesso fecha o circuito e reseta estágio; falha reabre no próximo degrau de cooldown;
  - enquanto `OPEN`, responde fail-fast `503 SEFAZ_TEMPORARILY_UNAVAILABLE` (< 5 ms) com header `Retry-After` sem disparar chamada à SEFAZ;
  - falha do Redis no Circuit Breaker degrada com segurança (fail-open com log `warn`, sem derrubar a API).

### RNF-05 — Observabilidade e Isolamento de `/health`
- Integrar `IMetricsRecorder` para registrar contadores e latência de:
  - consultas SEFAZ por `uf`, `channel` (`qrcode_v2` | `qrcode_v3`), `outcome` (`success` | `business_error` | `parse_error` | `timeout` | `network_error` | `http_error` | `response_too_large` | `cb_open` | `rate_limited`);
  - cache hits/misses (`fiscal_notes.cache.lookup`);
  - importações/vínculos/desvínculos (`fiscal_notes.operations`).
- Integrar `OperationalAlertService` para disparar alertas no Telegram (reutilizando cooldown/deduplicação da Issue `#143`):
  - `CRITICAL` (`FISCAL_NOTE_SEFAZ_CB_OPENED`) ao abrir o Circuit Breaker da UF;
  - `RESOLVED` (`FISCAL_NOTE_SEFAZ_CB_OPENED`) quando o Circuit Breaker fechar novamente;
  - `CRITICAL` (`FISCAL_NOTE_SEFAZ_PARSER_FAILURE`) em falha de parsing do HTML da SEFAZ;
  - `WARN` (`FISCAL_NOTE_SEFAZ_GLOBAL_RL_HIT`) ao atingir o limite global da VPS por UF;
  - `WARN` (`FISCAL_NOTE_UNKNOWN_QR_HOST`) quando uma URL de QR Code apontar para host desconhecido.
- **Zero alterações em `/health`:** a saúde da SEFAZ nunca influencia o healthcheck de liveness/readiness da API.

### RNF-06 — Modelagem PostgreSQL, Deploy Seguro e Padrão de Código
- Migration única estritamente aditiva (`expand`), reversível (`down`), compatível com deploy `N`/`N+1`.
- Valores monetários em `bigint` (centavos) com `CHECK >= 0`; `quantity` e `unit_price` em `NUMERIC(12, 4)` (`quantity > 0`, `unit_price >= 0`).
- Trigger `set_updated_at()` em `fiscal_notes`.
- **Zero magic strings evitáveis** conforme `AGENTS.md`: todos os códigos de erro, nomes de eventos de log, métricas, chaves de alerta, prefixos de chave Redis, `RESPONSE_OBJECT_TYPES`, estados de Circuit Breaker, nomes de endpoints/UFs e constantes de parser centralizados em objetos `as const` ou enums tipados.

## 7. Critérios de Aceite

1. Usuário autenticado consegue pré-visualizar NFC-e real da SEFAZ-CE via QR Code v2 e via chave de 44 dígitos, recebendo itens, pagamentos, totais corretos, `changeAmountCents: null` quando SEFAZ retorna `NaN`, sem qualquer dado de `Consumidor`.
2. Preview subsequente da mesma chave dentro do TTL retorna `cacheHit: true` sem nova chamada à SEFAZ, inclusive com Circuit Breaker aberto.
3. `POST /fiscal-notes/import` cria `Transaction (EXPENSE)` + `FiscalNote` + itens + pagamentos atomicamente; `TransactionResponseDto` reflete `hasFiscalNote: true` no detalhe e na listagem paginada.
4. `POST /transactions/:id/fiscal-note` vincula nota a uma `EXPENSE` existente sem sobrescrever valor, data ou descrição da transação, e bloqueia transações não-`EXPENSE` (`409`) ou que já possuem nota ativa (`409`).
5. Tentativa de importar chave já ativa para o mesmo usuário retorna `409 FISCAL_NOTE_ALREADY_IMPORTED` com `details: { existingTransactionId, existingFiscalNoteId }`, enquanto outro usuário consegue importar a mesma chave normalmente.
6. `DELETE /transactions/:id/fiscal-note` remove logicamente apenas a nota, mantendo a despesa ativa e liberando tanto a despesa quanto a chave de acesso.
7. `DELETE /transactions/:id` realiza soft delete sincronizado da nota ativa na mesma transação PostgreSQL, liberando a chave para reimportação.
8. Tentativa de alterar `type` de uma despesa com nota ativa via `PATCH /transactions/:id` ou `PATCH /transactions/:id/confirm` é bloqueada com `409`.
9. Proteções anti-SSRF, limite de 1 MB, timeout, retry único transitório, rate limits (HTTP + Redis usuário + global UF), Circuit Breaker progressivo + alertas Telegram (`CRITICAL`/`WARN`/`RESOLVED`) e logs Zero-PII validados por testes automatizados.
10. `format:check`, `lint:check`, `typecheck`, `build`, testes unitários, E2E e integração (Testcontainers PostgreSQL + Redis) passam integralmente em Node 24.
11. `GET /fiscal-notes` lista com paginação, ordenação allowlisted, filtros (`issuedFrom`/`issuedTo`, `issuerCnpj`, `sourceUf`, `minAmountCents`/`maxAmountCents`, `search` por estabelecimento ou descrição de item sem duplicar notas), `itemsCount` e `summary` agregado por usuário autenticado; e `GET /fiscal-notes/:id` retorna o detalhe completo da nota com isolamento multi-tenant (`404` para notas inexistentes, deletadas ou de outro usuário).
