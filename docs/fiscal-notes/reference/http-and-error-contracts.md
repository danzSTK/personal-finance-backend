---
area: fiscal-notes
type: reference
status: current
related:
  - ../flows/preview-and-resilience.md
  - ../flows/import-link-and-lifecycle.md
  - ../../errors/README.md
  - ../../platform/response-objects/response-objects.md
---

# HTTP and Error Contracts

Todos os endpoints de `fiscal-notes` operam sob o prefixo global `/api/v1` (rotas `/fiscal-notes/*` e `/transactions/:id/fiscal-note`) e passam pela cadeia padrão de guards (`OriginGuard` -> `JwtAuthGuard` -> `EmailVerificationStatusGuard` -> `ThrottlerGuard`). Não há rotas `@Public()`.

## Endpoints HTTP

| Método & Rota | Throttle da Rota | Status de Sucesso | `object` da Resposta | Descrição |
| --- | --- | --- | --- | --- |
| `GET /api/v1/fiscal-notes` | padrão global | `200 OK` | `fiscal_note.list` | Lista paginada leve (`fiscal_note.summary`) das notas ativas do usuário com filtros combináveis, ordenação allowlisted, `meta` e `summary` (`fiscal_note.summary_totals`) |
| `GET /api/v1/fiscal-notes/:id` | padrão global | `200 OK` | `fiscal_note.item` | Retorna detalhe completo de uma `FiscalNote` ativa do usuário por UUID com `items` e `payments` ordenados por `position ASC` |
| `POST /api/v1/fiscal-notes/preview` | `10 / 60s` | `200 OK` | `fiscal_note.preview` | Valida input, consulta cache/SEFAZ e retorna prévia sanitizada, status de duplicidade e `suggestedTransaction` |
| `POST /api/v1/fiscal-notes/import` | `10 / 60s` | `201 Created` | `fiscal_note.import` | Cria atomicamente `Transaction (EXPENSE)` + `FiscalNote` + itens + pagamentos |
| `POST /api/v1/transactions/:id/fiscal-note` | `10 / 60s` | `201 Created` | `fiscal_note.item` | Vincula `FiscalNote` a uma `EXPENSE` existente sem sobrescrever seus campos |
| `GET /api/v1/transactions/:id/fiscal-note` | padrão global | `200 OK` | `fiscal_note.item` | Retorna a `FiscalNote` ativa da transação com `items` e `payments` ordenados por `position ASC` |
| `DELETE /api/v1/transactions/:id/fiscal-note` | padrão global | `204 No Content` | — | Soft delete apenas da `FiscalNote`, preservando a transação |

### Contratos de Consulta (`GET /api/v1/fiscal-notes` e `GET /api/v1/fiscal-notes/:id`)

#### `GET /api/v1/fiscal-notes`

Lista apenas notas fiscais ativas (`deleted_at IS NULL`) pertencentes ao usuário autenticado (`@CurrentUser()`):

- **Paginação:**
  - `page`: inteiro `>= 1` (padrão `1`).
  - `limit`: inteiro entre `1` e `100` (padrão `20`).
- **Ordenação (`sort`):** allowlist fechada com desempate determinístico por `id` (`issuedAt:desc` como padrão):
  - `issuedAt:desc`, `issuedAt:asc`
  - `payableAmountCents:desc`, `payableAmountCents:asc`
  - `createdAt:desc`, `createdAt:asc`
- **Filtros opcionais combináveis (`AND`):**
  - `issuedFrom` / `issuedTo`: `DateOnly` (`YYYY-MM-DD`), validando `issuedFrom <= issuedTo`. Convertidos para limites `timestamptz` no intervalo `[issuedFrom 00:00:00.000-03:00, nextDay(issuedTo) 00:00:00.000-03:00)` sem envolver `issued_at` em funções SQL, preservando o índice `idx_fiscal_notes_user_issued_at_active`.
  - `issuerCnpj`: 14 dígitos numéricos, aceitando máscara opcional (`./-`) e espaços normalizados para 14 dígitos; formatos inválidos são rejeitados com `400`.
  - `sourceUf`: 2 dígitos numéricos (ex.: `23`).
  - `minAmountCents` / `maxAmountCents`: inteiros `>= 0` filtrando `payable_amount_cents`, validando `minAmountCents <= maxAmountCents`.
  - `search`: texto de até `120` caracteres, trimado e com escape de `\`, `%` e `_`, aplicando busca case-insensitive (`ILIKE`) em `issuer_name` **ou** em `fiscal_note_items.raw_description` via `EXISTS` (sem duplicar notas na paginação nem distorcer os agregados de `summary`).
- **Resposta `200 OK` (`ListFiscalNotesResponseDto`):**
  - `object`: `'fiscal_note.list'`.
  - `data`: lista leve de `FiscalNoteSummaryResponseDto` (`object: 'fiscal_note.summary'`, sem arrays `items[]` / `payments[]`), expondo `id`, `transactionId`, `accessKey`, `sourceUf`, `number`, `series`, `issuedAt`, `issuerName`, `issuerCnpj`, `grossAmountCents`, `discountAmountCents`, `payableAmountCents`, `taxAmountCents`, `itemsCount`, `createdAt` e `updatedAt`.
  - `meta`: `{ total, page, limit, totalPages, hasNextPage, hasPreviousPage }`.
  - `summary` (`ListFiscalNotesSummaryDto`, `object: 'fiscal_note.summary_totals'`): `{ totalNotes, totalGrossAmountCents, totalDiscountAmountCents, totalPayableAmountCents, totalTaxAmountCents }`.
- **Erros:** `400` (`FISCAL_NOTE_INVALID_INPUT` para faixas inválidas `issuedFrom > issuedTo` ou `minAmountCents > maxAmountCents`, ou validação de DTO para parâmetros de query inválidos) e `401` (`UNAUTHORIZED`).

#### `GET /api/v1/fiscal-notes/:id`

- **Parâmetro de rota:** `:id` validado como UUID (`ParseUUIDPipe`), com busca restrita por `(id, userId)` e `deleted_at IS NULL` (proteção anti-IDOR).
- **Resposta `200 OK`:** `FiscalNoteResponseDto` (`object: 'fiscal_note.item'`), contendo cabeçalho completo e `items` e `payments` ordenados por `position ASC`.
- **Erros:** `400` (UUID inválido), `401` (`UNAUTHORIZED`) e `404` (`FISCAL_NOTE_NOT_FOUND` quando inexistente, soft-deletada ou pertencente a outro usuário).

### Response Objects (`RESPONSE_OBJECT_TYPES`)

- **`fiscal_note.list` (`ListFiscalNotesResponseDto`):** envelope paginado da listagem (`data`, `meta`, `summary`).
- **`fiscal_note.summary` (`FiscalNoteSummaryResponseDto`):** item leve de listagem com `itemsCount`, sem arrays `items[]` e `payments[]`.
- **`fiscal_note.summary_totals` (`ListFiscalNotesSummaryDto`):** totais agregados do recorte filtrado (`totalNotes`, `totalGrossAmountCents`, `totalDiscountAmountCents`, `totalPayableAmountCents`, `totalTaxAmountCents`).
- **`fiscal_note.preview` (`FiscalNotePreviewResponseDto`):** expõe `alreadyImported`, `existingTransactionId`, `existingFiscalNoteId`, `cacheHit`, `suggestedTransaction` (`type: 'EXPENSE'`, `status: 'EFFECTIVE'`, `amountCents`, `date`, `description`) e `fiscalNote` (cabeçalho + `items` + `payments`, sem `Consumidor`).
- **`fiscal_note.import` (`ImportFiscalNoteResponseDto`):** expõe `transaction` (`TransactionResponseDto` com `hasFiscalNote: true`) e `fiscalNote` (`FiscalNoteResponseDto` com `object: 'fiscal_note.item'`).
- **`fiscal_note.item` (`FiscalNoteResponseDto`):** expõe dados persistidos da nota, `items` (`FiscalNoteItemResponseDto[]`) e `payments` (`FiscalNotePaymentResponseDto[]`).
- **Adição em `TransactionResponseDto`:** campo booleano `hasFiscalNote` indicando se a transação possui uma nota fiscal ativa vinculada.

## Tabela de Códigos de Erro

Todos os erros seguem o envelope `PlatformErrorResponse` produzido por `AppExceptionFilter`.

| Código (`code`) | HTTP Status | Camada / Classe | `details` / Headers | Quando ocorre |
| --- | --- | --- | --- | --- |
| `FISCAL_NOTE_INVALID_INPUT` | `400` | `DomainError` / `ApplicationError` (`FiscalNoteInvalidInputError`) | `details: null` | Entrada vazia, `> 1024` chars, URL não HTTP/HTTPS, parâmetro `p` ausente/malformado, chave != 44 dígitos, modelo != `65`, DV mod-11 inválido ou faixas inválidas na listagem (`issuedFrom > issuedTo` ou `minAmountCents > maxAmountCents`) |
| `INVALID_FISCAL_NOTE` | `400` | `DomainError` (`InvalidFiscalNoteError`) | `details: null` | Violação de invariante de domínio em `FiscalNote`, `FiscalNoteItem` ou `FiscalNotePayment` |
| `INVALID_TRANSACTION` | `400` | `DomainError` (`InvalidTransactionError`) | `details: null` | `effectiveAmountCents` inválido no `import` (ex.: nota com `payableAmountCents === 0` sem override positivo) |
| `FISCAL_NOTE_NOT_FOUND` | `404` | `ApplicationError` (`FiscalNoteNotFoundError`) | `details: null` | Nota fiscal inexistente, soft-deletada ou de outro usuário em `GET /fiscal-notes/:id`, ou transação sem nota fiscal ativa no `GET`/`DELETE /transactions/:id/fiscal-note` |
| `FISCAL_NOTE_SEFAZ_NOT_FOUND` | `404` | `ApplicationError` (`FiscalNoteSefazNotFoundError`) | `details: null` | SEFAZ retornou erro de nota inexistente / QR Code inválido |
| `TRANSACTION_NOT_FOUND` | `404` | `ApplicationError` (`TransactionNotFoundError`) | `details: null` | Transação inexistente, soft-deletada ou pertencente a outro usuário |
| `FISCAL_NOTE_ALREADY_IMPORTED` | `409` | `ApplicationError` (`FiscalNoteAlreadyImportedError`) | `details: { existingTransactionId, existingFiscalNoteId }` | Usuário já possui `FiscalNote` ativa com a mesma `accessKey` (pré-checagem ou race `23505` em `UQ_fiscal_notes_user_access_key_active`) |
| `TRANSACTION_ALREADY_HAS_FISCAL_NOTE` | `409` | `ApplicationError` (`TransactionAlreadyHasFiscalNoteError`) | `details: { existingFiscalNoteId }` | Transação já possui `FiscalNote` ativa (pré-checagem ou race `23505` em `UQ_fiscal_notes_transaction_active`) |
| `TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE` | `409` | `DomainError` (`TransactionTypeDoesNotSupportFiscalNoteError`) | `details: null` | Tentativa de vincular nota a transação não-`EXPENSE` ou de mudar `type` de uma transação com nota ativa |
| `FISCAL_NOTE_UNSUPPORTED_UF` | `422` | `DomainError` (`FiscalNoteUnsupportedUfError`) | `details: null` | UF extraída da chave não possui provedor registrado na V1 (`uf !== '23'`) |
| `FISCAL_NOTE_HOMOLOGATION_NOT_ALLOWED` | `422` | `DomainError` (`FiscalNoteHomologationNotAllowedError`) | `details: null` | Nota emitida em ambiente de homologação (`ambiente = 2` no QR ou banner/erro da SEFAZ) |
| `FISCAL_NOTE_CANCELLED_OR_DENIED` | `422` | `ApplicationError` (`FiscalNoteCancelledOrDeniedError`) | `details: null` | Nota cancelada ou denegada segundo retorno `{ erro }` ou HTML da SEFAZ |
| `FISCAL_NOTE_RATE_LIMIT_EXCEEDED` | `429` | `RetryAfterApplicationError` (`FiscalNoteRateLimitExceededError`) | `details: { retryAfterSeconds }` + header `Retry-After` | Usuário excedeu cota SEFAZ em cache miss (`5/1m` ou `30/1h`) |
| `FISCAL_NOTE_PARSE_FAILED` | `502` | `ApplicationError` (`FiscalNoteParseFailedError`) | `details: null` | JSON inesperado da SEFAZ, HTML vazio, estrutura quebrada ou falha de integridade pós-parsing |
| `FISCAL_NOTE_RESPONSE_TOO_LARGE` | `502` | `ApplicationError` (`FiscalNoteResponseTooLargeError`) | `details: null` | Resposta HTTP da SEFAZ excedeu o limite rígido de 1 MB (`1_048_576` bytes) |
| `SEFAZ_TEMPORARILY_UNAVAILABLE` | `503` | `RetryAfterApplicationError` (`SefazTemporarilyUnavailableError`) | `details: { retryAfterSeconds }` + header `Retry-After` | Circuit Breaker `OPEN`, cota global por UF excedida (`40/1m`), erro de rede ou HTTP `5xx` não recuperado |
| `SEFAZ_TIMEOUT` | `504` | `ApplicationError` (`SefazTimeoutError`) | `details: null` | Timeout HTTP na SEFAZ após tentativa inicial e 1 retry |
