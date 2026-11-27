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

Todos os endpoints de `fiscal-notes` operam nas rotas raiz (`/fiscal-notes/*` e `/transactions/:id/fiscal-note`) e passam pela cadeia padrão de guards (`OriginGuard` -> `JwtAuthGuard` -> `EmailVerificationStatusGuard` -> `ThrottlerGuard`). Não há rotas `@Public()`.

## Endpoints HTTP

| Método & Rota | Throttle da Rota | Status de Sucesso | `object` da Resposta | Descrição |
| --- | --- | --- | --- | --- |
| `POST /fiscal-notes/preview` | `10 / 60s` | `200 OK` | `fiscal_note.preview` | Valida input, consulta cache/SEFAZ e retorna prévia sanitizada, status de duplicidade e `suggestedTransaction` |
| `POST /fiscal-notes/import` | `10 / 60s` | `201 Created` | `fiscal_note.import` | Cria atomicamente `Transaction (EXPENSE)` + `FiscalNote` + itens + pagamentos |
| `POST /transactions/:id/fiscal-note` | `10 / 60s` | `201 Created` | `fiscal_note.item` | Vincula `FiscalNote` a uma `EXPENSE` existente sem sobrescrever seus campos |
| `GET /transactions/:id/fiscal-note` | padrão global | `200 OK` | `fiscal_note.item` | Retorna a `FiscalNote` ativa da transação com `items` e `payments` ordenados por `position ASC` |
| `DELETE /transactions/:id/fiscal-note` | padrão global | `204 No Content` | — | Soft delete apenas da `FiscalNote`, preservando a transação |

### Response Objects (`RESPONSE_OBJECT_TYPES`)

- **`fiscal_note.preview` (`FiscalNotePreviewResponseDto`):** expõe `alreadyImported`, `existingTransactionId`, `existingFiscalNoteId`, `cacheHit`, `suggestedTransaction` (`type: 'EXPENSE'`, `status: 'EFFECTIVE'`, `amountCents`, `date`, `description`) e `fiscalNote` (cabeçalho + `items` + `payments`, sem `Consumidor`).
- **`fiscal_note.import` (`ImportFiscalNoteResponseDto`):** expõe `transaction` (`TransactionResponseDto` com `hasFiscalNote: true`) e `fiscalNote` (`FiscalNoteResponseDto` com `object: 'fiscal_note.item'`).
- **`fiscal_note.item` (`FiscalNoteResponseDto`):** expõe dados persistidos da nota, `items` (`FiscalNoteItemResponseDto[]`) e `payments` (`FiscalNotePaymentResponseDto[]`).
- **Adição em `TransactionResponseDto`:** campo booleano `hasFiscalNote` indicando se a transação possui uma nota fiscal ativa vinculada.

## Tabela de Códigos de Erro

Todos os erros seguem o envelope `PlatformErrorResponse` produzido por `AppExceptionFilter`.

| Código (`code`) | HTTP Status | Camada / Classe | `details` / Headers | Quando ocorre |
| --- | --- | --- | --- | --- |
| `FISCAL_NOTE_INVALID_INPUT` | `400` | `DomainError` (`FiscalNoteInvalidInputError`) | `details: null` | Entrada vazia, `> 1024` chars, URL não HTTP/HTTPS, parâmetro `p` ausente/malformado, chave != 44 dígitos, modelo != `65` ou DV mod-11 inválido |
| `INVALID_FISCAL_NOTE` | `400` | `DomainError` (`InvalidFiscalNoteError`) | `details: null` | Violação de invariante de domínio em `FiscalNote`, `FiscalNoteItem` ou `FiscalNotePayment` |
| `INVALID_TRANSACTION` | `400` | `DomainError` (`InvalidTransactionError`) | `details: null` | `effectiveAmountCents` inválido no `import` (ex.: nota com `payableAmountCents === 0` sem override positivo) |
| `FISCAL_NOTE_NOT_FOUND` | `404` | `ApplicationError` (`FiscalNoteNotFoundError`) | `details: null` | Transação não possui nota fiscal ativa no `GET` ou `DELETE` |
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
