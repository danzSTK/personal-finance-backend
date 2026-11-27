---
area: fiscal-notes
type: spec-decisions
status: approved
issue: 144
---

# Decisions — Leitura e Importação de NFC-e (SEFAZ-CE)

Este documento registra as escolhas técnicas, alternativas avaliadas e impactos da feature de leitura e importação de NFC-e (Issue `#144`).

## DEC-01 — Desacoplamento Acíclico entre `fiscal-notes` e `transactions` via `FiscalNotesCoreModule`

- **Decisão:** Criar `FiscalNotesCoreModule` (no mesmo padrão consolidado de `AssetsCoreModule`), exportando `IFiscalNoteRepository` e o port `FiscalNoteTransactionLifecyclePort`. `TransactionsModule` importa `FiscalNotesCoreModule` e exporta `TransactionFiscalNotePort`. `FiscalNotesModule` importa `FiscalNotesCoreModule` e `TransactionsModule`.
- **Alternativas consideradas:**
  - `forwardRef(() => ...)` bidirecional entre `TransactionsModule` e `FiscalNotesModule`: rejeitada por introduzir acoplamento circular difícil de testar e manter.
  - Embutir `fiscal-notes` dentro de `transactions`: rejeitada pela decisão de produto/arquitetura de manter `fiscal-notes` como módulo dedicado para comportar parser, provedores por UF, Circuit Breaker e evolução futura (itens/produtos/novas UFs).
  - Apenas eventos assíncronos para soft delete sincronizado: rejeitada porque o soft delete da `FiscalNote` precisa ocorrer **na mesma transação PostgreSQL** do soft delete da `Transaction`, garantindo atomicidade imediata e liberação instantânea da `access_key`.
- **Impacto:** Grafo de módulos 100% acíclico (`FiscalNotesModule -> TransactionsModule -> FiscalNotesCoreModule`), aderente a `docs/architecture/module-boundaries.md`.

## DEC-02 — Biblioteca de Parsing HTML (`cheerio`)

- **Decisão:** Adicionar `cheerio` (`^1.0.0` / última v1 estável) em `api/package.json` para parsing do HTML retornado pela SEFAZ-CE e decodificação segura de entidades HTML no campo `erro`.
- **Alternativas consideradas:**
  - Regex pura sobre HTML: rejeitada por fragilidade extrema contra quebras de linha, `&nbsp;`, entidades malformadas e mudanças mínimas de atributos no HTML da SEFAZ.
  - `node-html-parser`: leve, porém menos aderente ao padrão WHATWG HTML5 para entidades malformadas observadas na pesquisa real da SEFAZ-CE (ex.: `&aacute` sem ponto e vírgula em `"100 - QR Code Inv&aacutelido"`).
  - `jsdom`: rejeitada pelo peso de memória/CPU e execução desnecessária de ambiente DOM/scripts.
- **Impacto:** `cheerio` usa `parse5` (HTML5 spec-compliant), zero binários nativos, suporta seletores CSS completos e não executa JavaScript (mitigando XSS/code execution durante parsing).

## DEC-03 — `bigint` para Valores Monetários em Centavos e `NUMERIC(12, 4)` para Quantidade/Preço Unitário

- **Decisão:**
  - `gross_amount_cents`, `discount_amount_cents`, `payable_amount_cents`, `tax_amount_cents`, `change_amount_cents` (`fiscal_notes`), `total_price_cents` (`fiscal_note_items`) e `amount_cents` (`fiscal_note_payments`) usam `bigint` no PostgreSQL (convertidos para `number` safe integer no domínio/DTO).
  - `quantity` e `unit_price` (`fiscal_note_items`) usam `NUMERIC(12, 4)` (armazenados/trafegados como string decimal normalizada ou número com precisão preservada; no domínio/API como `number` validado com até 4 casas decimais e `NUMERIC(12,4)` no banco).
- **Alternativas consideradas:**
  - `integer` (32-bit) para centavos em itens/pagamentos: rejeitada para manter consistência integral com `AGENTS.md` (todos os valores monetários em centavos na Danfy usam `bigint`) e evitar divergência de tipo com `transactions.amount_cents`.
  - `double precision` / `float` para `quantity` e `unit_price`: rejeitada por imprecisão binária em itens pesáveis (`0,468 kg` a `R$ 26,99/kg`).
- **Impacto:** Precisão exata para pesagem/fracionamento (até 4 casas decimais) e padrão monetário uniforme em centavos `bigint` em toda a base.

## DEC-04 — Preservação da Data Civil Local (`issuedDate`) Separada do Instante UTC (`issuedAt`)

- **Decisão:** Persistir `issued_at` em `timestamptz` (UTC exato, aplicando `-03:00` / `America/Fortaleza` quando o texto da SEFAZ-CE omitir offset explícito) e derivar `suggestedTransaction.date` (`DateOnlyString`, `YYYY-MM-DD`) diretamente da data civil local da emissão (nunca de `issuedAt.toISOString().slice(0, 10)`).
- **Alternativas consideradas:**
  - Derivar `date` a partir de `issuedAt.toISOString().slice(0, 10)` em UTC: rejeitada porque compras feitas entre 21h00 e 23h59 no horário de Fortaleza virariam o dia seguinte em UTC, gerando despesa na data errada.
- **Impacto:** Data sugerida da despesa sempre coincide com o dia real da compra no Ceará.

## DEC-05 — Circuit Breaker Genérico e Reutilizável em `api/src/shared/circuit-breaker/`

- **Decisão:** Implementar o Circuit Breaker distribuído baseado em Redis como módulo transversal em `api/src/shared/circuit-breaker/` (`CircuitBreakerService` + `CircuitBreakerModule`) com estado tipado (`CLOSED`, `OPEN`, `HALF_OPEN`), threshold configurável, cooldown progressivo (`[60, 120, 300]` segundos) e callbacks/eventos para observabilidade.
- **Alternativas consideradas:**
  - Acoplar o Circuit Breaker dentro de `SefazCeProvider`: rejeitada porque futuras integrações (novas UFs, Open Finance, cotações) precisarão do mesmo padrão.
  - Circuit Breaker somente em memória do processo: rejeitada porque múltiplas réplicas ou reinícios da API perderiam o estado de proteção contra a SEFAZ.
- **Impacto:** Proteção compartilhada via Redis com fallback seguro (fail-open com log `warn` se Redis estiver indisponível) e pronta para reuso em toda a plataforma.

## DEC-06 — `details` Estruturado em `ApplicationError` e Mapeamento no `AppExceptionFilter`

- **Decisão:** Estender `ApplicationError` com propriedade opcional `get details(): Record<string, unknown> | null` (padrão `null`) e atualizar `AppExceptionFilter` para propagar `exception.details ?? null` para qualquer `ApplicationError` (mantendo comportamento idêntico para `RetryAfterApplicationError` e demais erros que retornam `null`).
- **Alternativas consideradas:**
  - Criar filtro HTTP separado para `fiscal-notes`: rejeitada por violar o contrato único de erros da plataforma (`platform-errors`).
  - Serializar `existingTransactionId` dentro da string `message`: rejeitada porque força parsing frágil no frontend.
- **Impacto:** `409 FISCAL_NOTE_ALREADY_IMPORTED` entrega `details: { existingTransactionId, existingFiscalNoteId }` e `409 TRANSACTION_ALREADY_HAS_FISCAL_NOTE` entrega `details: { existingFiscalNoteId }` dentro do envelope padrão `PlatformErrorResponseDto`.

## DEC-07 — Isolamento de `http://` Exclusivamente no `SefazCeProvider`

- **Decisão:** A API pública observada da SEFAZ-CE opera exclusivamente em `http://nfce.sefaz.ce.gov.br` (HTTPS não responde/expira conforme pesquisa técnica). O uso de `http://` fica isolado na configuração dedicada `FISCAL_NOTES_SEFAZ_CE_BASE_URL` (padrão `http://nfce.sefaz.ce.gov.br`) e validado contra allowlist de protocolo/host dentro de `SefazCeProvider`, sem relaxar regras TLS/HTTPS globais do processo Node.js.
- **Alternativas consideradas:**
  - Desabilitar `NODE_TLS_REJECT_UNAUTHORIZED`: terminantemente rejeitada por risco grave de segurança global.
  - Aceitar a URL arbitrária vinda do QR Code do usuário: terminantemente rejeitada por risco de SSRF.
- **Impacto:** Superfície de risco mínima, zero SSRF e compatibilidade com o comportamento real da SEFAZ-CE.

## DEC-08 — Bloqueio de Mudança de `type` de Transação com Nota Fiscal Ativa

- **Decisão:** Em `UpdateTransactionUseCase` e `ConfirmTransactionUseCase`, caso o patch tente alterar `type` de uma transação para algo diferente de `EXPENSE` enquanto houver `FiscalNote` ativa vinculada, bloquear com `409 TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE` (mesmo padrão já aplicado a anexos em `TransactionTypeDoesNotSupportAttachmentsError`).
- **Alternativas consideradas:**
  - Permitir mudança de tipo deixando uma `INCOME`/`TRANSFER` com `FiscalNote` ativa: rejeitada por violar a invariante de domínio de que apenas despesas possuem nota fiscal.
  - Fazer soft delete silencioso da nota ao mudar o tipo: rejeitada por risco de perda inesperada de dados pelo usuário.
- **Impacto:** Invariante preservada em todos os fluxos de mutação; usuário pode desvincular explicitamente via `DELETE /transactions/:id/fiscal-note` se desejar trocar o tipo da transação.

## DEC-09 — Limpeza de `hasFiscalNote` em `TransactionResponseDto` sem N+1

- **Decisão:** Expor `hasFiscalNote: boolean` na entidade de domínio `Transaction` (default `false`, com `setHasFiscalNote(boolean)`) e no `TransactionResponseDto`, preenchido em lote via `findActiveTransactionIds(transactionIds)` no `ListTransactionsUseCase` (1 query `SELECT transaction_id FROM fiscal_notes WHERE transaction_id IN (...) AND deleted_at IS NULL`) e via `hasActiveByTransactionId` no `GetTransactionUseCase`, `UpdateTransactionUseCase` e `ConfirmTransactionUseCase`.
- **Alternativas consideradas:**
  - `LEFT JOIN` com `fiscal_notes` dentro de `TransactionRepository`: rejeitada por acoplar SQL do repositório de `transactions` a tabelas pertencentes ao módulo `fiscal-notes`.
  - Embutir `fiscalNote` inteiro na listagem de transações: rejeitada por bloat de payload e latência.
- **Impacto:** Segue exatamente o padrão já consolidado de `attachmentsCount` em `Transaction` + `ListTransactionsUseCase`, mantendo fronteira limpa entre módulos e performance constante (1 query em lote por página).

## DEC-10 — Dono Único de Criação de `Transaction` (`CreateTransactionUseCase`) e Derivação de DTO/Tipos

- **Decisão:**
  - Evoluir `CreateTransactionUseCase.execute(data, options?)` para aceitar `IRepositoryOptions` (`options?.manager`), reutilizando a transação PostgreSQL externa quando fornecida ou abrindo `dataSource.transaction` quando omitida, mantendo lock de saldo, validação de referências, `TransactionFactory.create` e `save()` centralizados em um único fluxo interno.
  - Fazer `TransactionFiscalNoteAdapter.createExpenseWithinTransaction` delegar diretamente para `CreateTransactionUseCase.execute({ ...input, type: EXPENSE, destinationAccountId: null, direction: null }, options)` e marcar `saved.setHasFiscalNote(true)`.
  - Derivar `CreateExpenseForFiscalNoteInput` de `CreateTransactionUseCaseInput` (`Omit<..., 'type' | 'destinationAccountId' | 'direction' | 'categoryId'> & { categoryId: string }`), `ImportFiscalNoteInput` de `CreateExpenseForFiscalNoteInput` e `ImportFiscalNoteDto` de `CreateTransactionDto` via `@nestjs/swagger` `OmitType`.
- **Alternativas consideradas:**
  - Manter cópia manual de campos e da sequência lock/validate/create/save no `TransactionFiscalNoteAdapter` e nos DTOs de importação: rejeitada por alto risco de drift quando `CreateTransactionDto` / `CreateTransactionUseCase` ganharem novos campos ou regras.
- **Impacto:** Garante ponto único de criação de transações e propagação automática de novos campos/validações sem quebrar o isolamento transacional de `ImportFiscalNoteUseCase`.

## DEC-11 — Liberação do Probe Lock (`releaseProbe`) em Rejeição Prévia de Rate Limit na Sonda `HALF_OPEN`

- **Decisão:** Preservar a ordem `circuitBreaker.canExecute` antes de `rateLimiter.consumeSefazQuota` (evitando que requisições com circuito `OPEN` consumam cota), e adicionar `CircuitBreakerService.releaseProbe(options)` para liberar o lock `:probe` e restaurar `HALF_OPEN -> OPEN` (preservando `consecutiveFailures`, `cooldownStage`, `openedAtMs` e `nextAttemptAtMs` já expirados) sempre que `consumeSefazQuota` rejeitar uma requisição que havia recebido sonda `HALF_OPEN`.
- **Alternativas consideradas:**
  - Checar rate limit antes de `canExecute`: rejeitada porque queimaria cota do usuário/global mesmo quando o circuito já estivesse `OPEN` falhando rápido.
  - Aguardar expiração natural do TTL do lock `:probe` (20s–38s): rejeitada porque atrasa a recuperação da SEFAZ sem sequer tê-la sondado.
- **Impacto:** O próximo usuário elegível após rejeição por rate limit em `HALF_OPEN` pode sondar a SEFAZ imediatamente, sem falso bloqueio até o TTL do lock expirar.

## DEC-12 — Listagem Paginada Leve (`GET /fiscal-notes`) com `EXISTS` e Detalhe Direto (`GET /fiscal-notes/:id`)

- **Decisão:**
  - Expor `GET /fiscal-notes` retornando `ListFiscalNotesResponseDto` (`object: 'fiscal_note.list'`) com `data` leve (`object: 'fiscal_note.summary'`, incluindo `itemsCount` sem embutir arrays de itens/pagamentos), `meta` de paginação e `summary` agregado (`object: 'fiscal_note.summary_totals'`).
  - Expor `GET /fiscal-notes/:id` retornando `FiscalNoteResponseDto` (`object: 'fiscal_note.item'`) completo filtrado por `(id, userId)`.
  - Implementar busca `search` sobre `issuer_name` ou `fiscal_note_items.raw_description` via `EXISTS` (com escape de `\`, `%`, `_`) para nunca duplicar notas na paginação ou distorcer agregados do `summary`.
  - Converter filtros `DateOnly` (`issuedFrom`/`issuedTo`) para limites `timestamptz` no offset `-03:00` (`[issuedFrom 00:00:00-03:00, nextDay(issuedTo) 00:00:00-03:00)`) sem aplicar função sobre a coluna `issued_at`, preservando o uso do índice composto parcial `idx_fiscal_notes_user_issued_at_active (user_id, issued_at DESC) WHERE deleted_at IS NULL`.
- **Alternativas consideradas:**
  - `LEFT JOIN fiscal_note_items` diretamente na query paginada: rejeitada porque multiplica linhas por item, exige `DISTINCT`/subquery extra e distorce `SUM(...)` do `summary`.
  - Embutir `items[]` e `payments[]` na listagem paginada: rejeitada por bloat de payload e memória (uma nota de supermercado pode ter 50+ itens).
  - Aplicar `DATE(issued_at AT TIME ZONE ...)` no `WHERE`: rejeitada por impedir o uso do índice B-Tree em `(user_id, issued_at DESC)`.
- **Impacto:** Listagem rápida (2 queries por página, ou 1 se `total === 0`), paginação estável com desempate determinístico por `id`, zero N+1 e filtro de texto seguro contra SQL/LIKE wildcards.
