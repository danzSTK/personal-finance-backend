# Módulo Fiscal Notes — Instruções Locais

Este módulo implementa a leitura, validação local, consulta resiliente à SEFAZ (V1: SEFAZ-CE `UF = 23`), parsing sanitizado, listagem/consulta e persistência de NFC-e (modelo `65`) vinculada a despesas (`EXPENSE`).

## Documentação Obrigatória

Antes de planejar ou alterar código neste módulo, leia:

- `docs/fiscal-notes/README.md` — Índice e mapa da documentação viva do módulo.
- `docs/architecture/module-boundaries.md` — Fronteira acíclica `FiscalNotesCoreModule` / `TransactionsModule`.
- `docs/platform/observability/README.md` — Métricas leves (`IMetricsRecorder`), alertas Telegram (`OperationalAlertService`) e isolamento de `/health`.
- `docs/database/schema.md` — Tabelas `fiscal_notes`, `fiscal_note_items` e `fiscal_note_payments`.

## Superfície do Módulo (Endpoints, Use Cases e Repositório)

- **Endpoints HTTP (`/api/v1`):**
  - `GET /fiscal-notes` (`ListFiscalNotesUseCase`) — listagem paginada leve (`fiscal_note.list` / `fiscal_note.summary` / `fiscal_note.summary_totals`) com filtros combináveis, ordenação allowlisted e `summary` agregado;
  - `GET /fiscal-notes/:id` (`GetFiscalNoteUseCase`) — detalhe direto por UUID (`fiscal_note.item`) com isolamento por `(id, userId)`;
  - `POST /fiscal-notes/preview` (`PreviewFiscalNoteUseCase`), `POST /fiscal-notes/import` (`ImportFiscalNoteUseCase`), `POST /transactions/:id/fiscal-note` (`LinkFiscalNoteUseCase`), `GET /transactions/:id/fiscal-note` (`GetTransactionFiscalNoteUseCase`), `DELETE /transactions/:id/fiscal-note` (`UnlinkTransactionFiscalNoteUseCase`).
- **Métodos de `IFiscalNoteRepository`:** `list`, `findActiveByIdAndUserId`, `findActiveByUserIdAndAccessKey`, `findActiveByTransactionId`, `findActiveByTransactionIdAndUserId`, `hasActiveByTransactionId`, `findActiveTransactionIds`, `save`, `softDeleteByTransactionId`.

## Regras de Domínio e Invariantes

- **LGPD e Zero-PII:** Nunca persista HTML/XML bruto da SEFAZ (PostgreSQL, Redis, R2 ou logs). O parser (`SefazCeHtmlParser`) deve sempre remover o bloco `Consumidor` antes de extrair dados. Nunca logue payload completo de QR Code, CNPJ cru ou chave completa fora de `maskAccessKeyForLog()`.
- **Proteção Anti-SSRF e Isolamento de `http://`:** Nunca faça requisições HTTP para URLs enviadas pelo cliente. Extraia apenas o parâmetro `p` localmente no `FiscalNoteInput`, valide o host contra `FISCAL_NOTE_ALLOWED_HOSTS_BY_UF` e isole chamadas `http://` exclusivamente em `SefazCeHttpClient` com `redirect: 'error'`, timeout e limite rígido de 1 MB.
- **Zero Magic Strings:** Centralize códigos de erro, UFs, eventos de log, métricas, chaves de alerta, constraints DB e constantes de parser em `api/src/modules/fiscal-notes/domain/constants/fiscal-notes.constants.ts`, `RESPONSE_OBJECT_TYPES` e `CacheKeys.fiscalNotes`.
- **Fronteira Acíclica com `transactions`:** `FiscalNotesCoreModule` **não** pode importar `TransactionsModule`; comunique-se exclusivamente via `FiscalNoteTransactionLifecyclePort` e `TransactionFiscalNotePort`. Nunca mantenha transação PostgreSQL aberta durante chamadas HTTP externas (`FiscalNoteQueryService.resolve` roda sempre antes de `dataSource.transaction`).
- **Precisão Monetária e Temporal:** Valores monetários (`*_amount_cents`, `total_price_cents`) usam inteiros seguros em centavos (`bigint`). `quantity` e `unit_price` usam `NUMERIC(12, 4)`. Separe `issuedDate` (`DateOnly` local da emissão) de `issuedAt` (`Instant` UTC com offset `-03:00`).
- **Invariantes de Listagem e Consulta (`list` / `findActiveByIdAndUserId`):**
  - Filtre sempre por `userId` e `deleted_at IS NULL` (proteção anti-IDOR e exclusão de soft-deletadas).
  - Converta `issuedFrom`/`issuedTo` (`DateOnly`) para limites `timestamptz` no offset `-03:00` (`[issuedFrom 00:00:00.000-03:00, nextDay(issuedTo) 00:00:00.000-03:00)`) sem envolver `issued_at` em funções SQL, preservando o índice parcial composto `idx_fiscal_notes_user_issued_at_active` (`(user_id, issued_at DESC) WHERE deleted_at IS NULL`).
  - Implemente `search` sobre `issuer_name` ou `fiscal_note_items.raw_description` exclusivamente via `EXISTS` (com escape de `\`, `%` e `_`), nunca com `LEFT JOIN` na query paginada, para evitar duplicação de notas ou distorção de `summary`.
  - Aplique ordenação apenas sobre a allowlist fechada com desempate determinístico por `id`.
- **Isolamento de `/health`:** Nunca adicione indicadores de saúde da SEFAZ ou do Circuit Breaker em `/health/liveness` ou `/health/readiness`.
