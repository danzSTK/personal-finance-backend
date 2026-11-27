---
area: fiscal-notes
type: spec-design
status: approved
issue: 144
---

# Design — Leitura e Importação de NFC-e (SEFAZ-CE)

## 1. Visão Arquitetural e Fronteiras de Módulo

A feature introduz:

1. Um módulo transversal reutilizável de resiliência: **`api/src/shared/circuit-breaker/`** (`CircuitBreakerModule`, `CircuitBreakerService`).
2. Um módulo de domínio dedicado: **`api/src/modules/fiscal-notes/`** em Clean Architecture + DDD, subdividido em:
   - **`FiscalNotesCoreModule`** (sem dependência de `TransactionsModule`): encapsula ORM entities, `IFiscalNoteRepository` e `FiscalNoteTransactionLifecyclePort` para consumo seguro por `TransactionsModule`.
   - **`FiscalNotesModule`** (importado por `ApiModule`): importa `FiscalNotesCoreModule`, `TransactionsModule`, `CircuitBreakerModule` e `ConfigModule` (feature `fiscalNotesConfig`), expondo controllers HTTP, use cases, parser HTML, provedor SEFAZ-CE, cache Redis e rate limiter de cache-miss.
3. Integração enxuta em **`TransactionsModule`**:
   - consome `FiscalNoteTransactionLifecyclePort` (`hasActiveByTransactionId`, `findActiveTransactionIds`, `softDeleteByTransactionId`);
   - exporta `TransactionFiscalNotePort` (`createExpenseWithinTransaction`, `lockAndValidateExpenseForFiscalNoteLink`, `assertTransactionAccessible`).

### Grafo Acíclico de Dependências

```text
ApiModule
 ├── FiscalNotesModule
 │    ├── FiscalNotesCoreModule (TypeORM fiscal_notes*, IFiscalNoteRepository, FiscalNoteTransactionLifecyclePort)
 │    ├── TransactionsModule (exporta TransactionFiscalNotePort)
 │    └── CircuitBreakerModule (RedisService)
 └── TransactionsModule
      └── FiscalNotesCoreModule (consome FiscalNoteTransactionLifecyclePort)
```

Nenhuma dependência circular (`forwardRef` não é necessário) e nenhum acesso direto entre repositórios de módulos diferentes.

## 2. Estrutura de Diretórios

```text
api/src/shared/circuit-breaker/
├── constants/
│   └── circuit-breaker.constants.ts
├── contracts/
│   └── circuit-breaker.interface.ts
├── circuit-breaker.service.ts
├── circuit-breaker.service.spec.ts
├── circuit-breaker.module.ts
└── index.ts

api/src/config/
├── fiscal-notes.config.ts
└── fiscal-notes.config.spec.ts

api/src/modules/fiscal-notes/
├── AGENTS.md
├── fiscal-notes-core.module.ts
├── fiscal-notes.module.ts
├── domain/
│   ├── constants/
│   │   └── fiscal-notes.constants.ts          # códigos de erro, UFs, canais, métricas, eventos, alertas, TTLs, limites, regex/labels
│   ├── entities/
│   │   ├── fiscal-note.entity.ts
│   │   ├── fiscal-note.entity.spec.ts
│   │   ├── fiscal-note-item.entity.ts
│   │   └── fiscal-note-payment.entity.ts
│   ├── errors/
│   │   ├── index.ts
│   │   └── invalid-fiscal-note.error.ts
│   ├── repositories/
│   │   ├── index.ts
│   │   └── fiscal-note.repository.interface.ts
│   └── value-objects/
│       ├── fiscal-note-input.vo.ts            # parser local de URL/QR v2/v3 e chave 44 dígitos + mod-11 + allowlist check
│       └── fiscal-note-input.vo.spec.ts
├── application/
│   ├── errors/
│   │   ├── index.ts
│   │   ├── fiscal-note-invalid-input.error.ts
│   │   ├── fiscal-note-unsupported-uf.error.ts
│   │   ├── fiscal-note-homologation-not-allowed.error.ts
│   │   ├── fiscal-note-not-found.error.ts
│   │   ├── fiscal-note-sefaz-not-found.error.ts
│   │   ├── fiscal-note-cancelled-or-denied.error.ts
│   │   ├── fiscal-note-already-imported.error.ts
│   │   ├── transaction-already-has-fiscal-note.error.ts
│   │   ├── fiscal-note-rate-limit-exceeded.error.ts
│   │   ├── sefaz-temporarily-unavailable.error.ts
│   │   ├── sefaz-timeout.error.ts
│   │   ├── fiscal-note-parse-failed.error.ts
│   │   └── fiscal-note-response-too-large.error.ts
│   ├── ports/
│   │   ├── fiscal-note-cache.port.ts
│   │   ├── fiscal-note-provider.port.ts       # IFiscalNoteProvider + ParsedFiscalNoteData
│   │   ├── fiscal-note-provider-registry.port.ts
│   │   ├── fiscal-note-rate-limiter.port.ts
│   │   └── fiscal-note-transaction-lifecycle.port.ts
│   ├── services/
│   │   ├── fiscal-note-query.service.ts       # orquestra validação + cache Redis + CB + rate limit + provider + métricas + alertas
│   │   ├── fiscal-note-query.service.spec.ts
│   │   └── fiscal-note-transaction-lifecycle.adapter.ts
│   └── use-cases/
│       ├── preview-fiscal-note/
│       │   ├── preview-fiscal-note.dto.ts
│       │   ├── preview-fiscal-note.use-case.ts
│       │   └── preview-fiscal-note.use-case.spec.ts
│       ├── import-fiscal-note/
│       │   ├── import-fiscal-note.dto.ts
│       │   ├── import-fiscal-note.use-case.ts
│       │   └── import-fiscal-note.use-case.spec.ts
│       ├── link-fiscal-note/
│       │   ├── link-fiscal-note.dto.ts
│       │   ├── link-fiscal-note.use-case.ts
│       │   └── link-fiscal-note.use-case.spec.ts
│       ├── get-transaction-fiscal-note/
│       │   ├── get-transaction-fiscal-note.dto.ts
│       │   ├── get-transaction-fiscal-note.use-case.ts
│       │   └── get-transaction-fiscal-note.use-case.spec.ts
│       └── unlink-transaction-fiscal-note/
│           ├── unlink-transaction-fiscal-note.dto.ts
│           ├── unlink-transaction-fiscal-note.use-case.ts
│           └── unlink-transaction-fiscal-note.use-case.spec.ts
├── infrastructure/
│   ├── cache/
│   │   ├── redis-fiscal-note.cache.ts
│   │   └── redis-fiscal-note.cache.spec.ts
│   ├── mappers/
│   │   └── fiscal-note.mapper.ts
│   ├── persistence/
│   │   ├── fiscal-note-orm.entity.ts
│   │   ├── fiscal-note-item-orm.entity.ts
│   │   ├── fiscal-note-payment-orm.entity.ts
│   │   └── fiscal-note.repository.ts
│   ├── providers/
│   │   ├── fiscal-note-provider.registry.ts
│   │   └── sefaz-ce/
│   │       ├── sefaz-ce.http-client.ts        # fetch com timeout, 1 MB streaming limit, 1 retry transitório, allowlist host
│   │       ├── sefaz-ce.http-client.spec.ts
│   │       ├── sefaz-ce-html.parser.ts        # cheerio HTML5 parser, descarte Consumidor, integridade, NaN -> null
│   │       ├── sefaz-ce-html.parser.spec.ts
│   │       ├── sefaz-ce.provider.ts
│   │       ├── sefaz-ce.provider.spec.ts
│   │       └── __fixtures__/                  # fixtures HTML sanitizadas (normal, descontos/NaN, cancelada, quebrada, com bloco Consumidor)
│   └── rate-limit/
│       ├── redis-fiscal-note-rate-limiter.ts
│       └── redis-fiscal-note-rate-limiter.spec.ts
└── presentation/
    ├── dto/
    │   ├── preview-fiscal-note.dto.ts
    │   ├── import-fiscal-note.dto.ts
    │   ├── link-fiscal-note.dto.ts
    │   ├── fiscal-note.response.dto.ts
    │   ├── fiscal-note-preview.response.dto.ts
    │   └── import-fiscal-note.response.dto.ts
    └── http/
        ├── fiscal-notes.controller.ts
        ├── fiscal-notes.controller.spec.ts
        ├── transaction-fiscal-note.controller.ts
        └── transaction-fiscal-note.controller.spec.ts
```

## 3. Modelagem PostgreSQL e Migration (`expand`-only)

Migration: `api/src/database/migrations/1789000000000-CreateFiscalNotesTables.ts` (classe `CreateFiscalNotesTables1789000000000`).
100% aditiva (`CREATE TABLE`, `CREATE INDEX`, `CREATE TRIGGER`), reversível (`down` remove trigger e tabelas na ordem reversa `fiscal_note_payments`, `fiscal_note_items`, `fiscal_notes`), segura para deploy `N`/`N+1`.

### Tabela `fiscal_notes`

| Coluna | Tipo | Nulabilidade / Default | Observação |
| --- | --- | --- | --- |
| `id` | `uuid` | `NOT NULL DEFAULT gen_random_uuid()` | PK `PK_fiscal_notes` |
| `user_id` | `uuid` | `NOT NULL` | FK `FK_fiscal_notes_user` -> `users(id) ON DELETE RESTRICT` |
| `transaction_id` | `uuid` | `NOT NULL` | FK `FK_fiscal_notes_transaction` -> `transactions(id) ON DELETE RESTRICT` |
| `access_key` | `char(44)` | `NOT NULL` | Chave de 44 dígitos (`CHK_fiscal_notes_access_key_digits`: `access_key ~ '^[0-9]{44}$'`) |
| `source_uf` | `char(2)` | `NOT NULL` | Código IBGE da UF (`CHK_fiscal_notes_source_uf_digits`: `source_uf ~ '^[0-9]{2}$'`) |
| `number` | `varchar(20)` | `NOT NULL` | Número da NFC-e |
| `series` | `varchar(10)` | `NOT NULL` | Série da NFC-e |
| `issued_at` | `timestamptz` | `NOT NULL` | Instante exato da emissão em UTC |
| `protocol` | `varchar(64)` | `NULL` | Protocolo de autorização SEFAZ |
| `issuer_name` | `varchar(255)` | `NOT NULL` | Razão social / nome do estabelecimento |
| `issuer_cnpj` | `char(14)` | `NOT NULL` | Apenas dígitos (`CHK_fiscal_notes_issuer_cnpj_digits`: `issuer_cnpj ~ '^[0-9]{14}$'`) |
| `issuer_address` | `text` | `NULL` | Endereço textual do estabelecimento |
| `gross_amount_cents` | `bigint` | `NOT NULL` | `CHECK (gross_amount_cents >= 0)` |
| `discount_amount_cents` | `bigint` | `NOT NULL DEFAULT 0` | `CHECK (discount_amount_cents >= 0)` |
| `payable_amount_cents` | `bigint` | `NOT NULL` | `CHECK (payable_amount_cents >= 0)` |
| `tax_amount_cents` | `bigint` | `NOT NULL DEFAULT 0` | `CHECK (tax_amount_cents >= 0)` |
| `change_amount_cents` | `bigint` | `NULL` | `CHECK (change_amount_cents IS NULL OR change_amount_cents >= 0)` |
| `xml_version` | `varchar(16)` | `NULL` | Versão XML (ex.: `4.00`) |
| `xslt_version` | `varchar(16)` | `NULL` | Versão XSLT (ex.: `2.05`) |
| `parser_version` | `varchar(32)` | `NOT NULL` | Versão do parser que extraiu a nota (ex.: `sefaz-ce-html-v1`) |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Trigger `trg_fiscal_notes_updated_at` -> `set_updated_at()` |
| `deleted_at` | `timestamptz` | `NULL` | Soft delete (sincronizado com `transactions` ou desvínculo manual) |

**Índices de `fiscal_notes`:**
- `UQ_fiscal_notes_user_access_key_active`: `CREATE UNIQUE INDEX "UQ_fiscal_notes_user_access_key_active" ON "fiscal_notes" ("user_id", "access_key") WHERE "deleted_at" IS NULL`
- `UQ_fiscal_notes_transaction_active`: `CREATE UNIQUE INDEX "UQ_fiscal_notes_transaction_active" ON "fiscal_notes" ("transaction_id") WHERE "deleted_at" IS NULL`
- `idx_fiscal_notes_user_id`: `CREATE INDEX "idx_fiscal_notes_user_id" ON "fiscal_notes" ("user_id")` (não parcial; cobre a FK `FK_fiscal_notes_user` `ON DELETE RESTRICT` inclusive em linhas soft-deletadas)
- `idx_fiscal_notes_user_issued_at_active`: `CREATE INDEX "idx_fiscal_notes_user_issued_at_active" ON "fiscal_notes" ("user_id", "issued_at" DESC) WHERE "deleted_at" IS NULL` (otimiza a listagem paginada `GET /fiscal-notes` ordenada por `issued_at DESC` e filtros por período)
- `idx_fiscal_notes_transaction_id`: `CREATE INDEX "idx_fiscal_notes_transaction_id" ON "fiscal_notes" ("transaction_id")` (cobre FK lookup inclusive para registros históricos)

### Tabela `fiscal_note_items`

| Coluna | Tipo | Nulabilidade / Default | Observação |
| --- | --- | --- | --- |
| `id` | `uuid` | `NOT NULL DEFAULT gen_random_uuid()` | PK `PK_fiscal_note_items` |
| `fiscal_note_id` | `uuid` | `NOT NULL` | FK `FK_fiscal_note_items_fiscal_note` -> `fiscal_notes(id) ON DELETE CASCADE` |
| `position` | `integer` | `NOT NULL` | `CHECK (position >= 1)` |
| `raw_description` | `varchar(500)` | `NOT NULL` | Descrição original do item na nota |
| `store_code` | `varchar(64)` | `NULL` | Código do produto no estabelecimento |
| `unit` | `varchar(20)` | `NOT NULL` | Unidade comercial (`UN`, `KG`, `LT`, etc.) |
| `quantity` | `numeric(12, 4)` | `NOT NULL` | `CHECK (quantity > 0)` |
| `unit_price` | `numeric(12, 4)` | `NOT NULL` | `CHECK (unit_price >= 0)` |
| `total_price_cents` | `bigint` | `NOT NULL` | `CHECK (total_price_cents >= 0)` |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

**Constraints / Índices de `fiscal_note_items`:**
- `UQ_fiscal_note_items_fiscal_note_position`: `UNIQUE ("fiscal_note_id", "position")` (já serve como índice composto com `fiscal_note_id` como prefixo para buscas ordenadas por `position`).

### Tabela `fiscal_note_payments`

| Coluna | Tipo | Nulabilidade / Default | Observação |
| --- | --- | --- | --- |
| `id` | `uuid` | `NOT NULL DEFAULT gen_random_uuid()` | PK `PK_fiscal_note_payments` |
| `fiscal_note_id` | `uuid` | `NOT NULL` | FK `FK_fiscal_note_payments_fiscal_note` -> `fiscal_notes(id) ON DELETE CASCADE` |
| `position` | `integer` | `NOT NULL` | `CHECK (position >= 1)` |
| `method_label` | `varchar(120)` | `NOT NULL` | Ex.: `Cartão de Débito`, `PIX`, `Dinheiro` |
| `amount_cents` | `bigint` | `NOT NULL` | `CHECK (amount_cents >= 0)` |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

**Constraints / Índices de `fiscal_note_payments`:**
- `UQ_fiscal_note_payments_fiscal_note_position`: `UNIQUE ("fiscal_note_id", "position")`.

**Registro em `api/src/config/entities.ts`:** adicionar `FiscalNoteOrmEntity`, `FiscalNoteItemOrmEntity`, `FiscalNotePaymentOrmEntity`.

## 4. Política de Zero Magic Strings e Constantes Centralizadas

Conforme `AGENTS.md` (`### Avoidable magic strings`):

1. **`api/src/shared/circuit-breaker/constants/circuit-breaker.constants.ts`**:
   - `CircuitBreakerStates = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' } as const`
   - `CircuitBreakerLogEvents = { CIRCUIT_OPENED, CIRCUIT_HALF_OPEN, CIRCUIT_CLOSED, REDIS_ERROR } as const`
   - `DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5`
   - `DEFAULT_CIRCUIT_BREAKER_COOLDOWN_SECONDS = [60, 120, 300] as const`
2. **`api/src/modules/fiscal-notes/domain/constants/fiscal-notes.constants.ts`**:
   - `FiscalNoteErrorCodes`: todos os códigos de erro do módulo (usados nas classes `*Error` e importados diretamente no `ERROR_STATUS_BY_CODE` do `AppExceptionFilter`);
   - `FiscalNoteSupportedUfs = { CE: '23' } as const`;
   - `FISCAL_NOTE_MODEL_NFCE = '65'`;
   - `FISCAL_NOTE_ENVIRONMENT_PRODUCTION = '1'`;
   - `FISCAL_NOTE_ENVIRONMENT_HOMOLOGATION = '2'`;
   - `FiscalNoteQueryChannels = { QRCODE_V2: 'qrcode_v2', QRCODE_V3: 'qrcode_v3' } as const`;
   - `FiscalNoteQueryOutcomes = { SUCCESS, BUSINESS_ERROR, PARSE_ERROR, TIMEOUT, NETWORK_ERROR, HTTP_ERROR, RESPONSE_TOO_LARGE, CB_OPEN, RATE_LIMITED } as const`;
   - `FiscalNoteOperations = { PREVIEW, IMPORT, LINK, GET, UNLINK } as const`;
   - `FiscalNoteCacheLookupResults = { HIT: 'hit', MISS: 'miss' } as const`;
   - `FiscalNoteLogEvents`: eventos estruturados de log (`FISCAL_NOTE_UNKNOWN_QR_HOST`, `FISCAL_NOTE_SEFAZ_REQUEST_FAILED`, `FISCAL_NOTE_SEFAZ_PARSER_FAILURE`, `FISCAL_NOTE_SEFAZ_CB_OPENED`, `FISCAL_NOTE_SEFAZ_CB_CLOSED`, `FISCAL_NOTE_SEFAZ_GLOBAL_RL_HIT`, `FISCAL_NOTE_CACHE_REDIS_ERROR`, `FISCAL_NOTE_RATE_LIMIT_REDIS_ERROR`);
   - `FiscalNoteMetricNames`: `fiscal_notes.sefaz.query.total`, `fiscal_notes.sefaz.query.duration_ms`, `fiscal_notes.cache.lookup.total`, `fiscal_notes.operations.total`;
   - `FiscalNoteAlertKeys`: builders tipados para `OperationalAlertService`:
     - `sefazCircuitBreaker: (uf: string) => \`fiscal-notes:sefaz:cb:${uf}\``
     - `sefazParserFailure: (uf: string) => \`fiscal-notes:sefaz:parser:${uf}\``
     - `sefazGlobalRateLimit: (uf: string) => \`fiscal-notes:sefaz:global-rl:${uf}\``
     - `unknownQrHost: (uf: string) => \`fiscal-notes:qr:unknown-host:${uf}\``
   - `FiscalNoteDbConstraints`: `UQ_fiscal_notes_user_access_key_active`, `UQ_fiscal_notes_transaction_active` (usados para detectar `23505` sem string literal solta);
   - `SEFAZ_CE_PARSER_VERSION = 'sefaz-ce-html-v1'`, `SEFAZ_CE_ALLOWED_HOSTS = ['nfce.sefaz.ce.gov.br'] as const`, `SEFAZ_CE_PATHS = { QRCODE_V2: '/nfce/api/notasFiscal/qrcodev2/', QRCODE_V3: '/nfce/api/notasFiscal/qrcodev3/' } as const`, `SEFAZ_CE_TIMEZONE_OFFSET = '-03:00'`;
   - Constantes de listagem paginada (`FISCAL_NOTE_LIST_DEFAULT_PAGE = 1`, `FISCAL_NOTE_LIST_DEFAULT_LIMIT = 20`, `FISCAL_NOTE_LIST_MAX_LIMIT = 100`, `FISCAL_NOTE_LIST_SEARCH_MAX_LENGTH = 120`, `FiscalNoteListSorts`, `FISCAL_NOTE_LIST_SORT_VALUES`, `FISCAL_NOTE_LIST_DEFAULT_SORT = 'issuedAt:desc'`);
   - Defaults de throttle/rate-limit/HTTP/cache (`FISCAL_NOTES_HTTP_THROTTLE_LIMIT = 10`, `FISCAL_NOTES_HTTP_THROTTLE_TTL_MS = 60_000`, `FISCAL_NOTES_MAX_RESPONSE_BYTES = 1_048_576`, `FISCAL_NOTES_DEFAULT_TIMEOUT_MS = 7000`, `FISCAL_NOTES_DEFAULT_RETRY_BACKOFF_MS = 400`, `FISCAL_NOTES_DEFAULT_CACHE_TTL_SECONDS = 1200`, etc.).
3. **`api/src/common/models/constants/response-object.constants.ts`**:
   - Adicionar:
     - `FISCAL_NOTE_PREVIEW: 'fiscal_note.preview'`
     - `FISCAL_NOTE_IMPORT: 'fiscal_note.import'`
     - `FISCAL_NOTE_ITEM: 'fiscal_note.item'`
     - `FISCAL_NOTE_LIST: 'fiscal_note.list'`
     - `FISCAL_NOTE_SUMMARY: 'fiscal_note.summary'`
     - `FISCAL_NOTE_SUMMARY_TOTALS: 'fiscal_note.summary_totals'`
4. **`api/src/common/utils/cache-keys.factory.ts`**:
   - Adicionar namespace `fiscalNotes`:
     - `parsed: (accessKey: string) => \`fiscal-notes:parsed:v1:${accessKey}\``
     - `rateLimitUser1m: (userId: string) => \`fiscal-notes:rl:sefaz:user:${userId}:1m\``
     - `rateLimitUser1h: (userId: string) => \`fiscal-notes:rl:sefaz:user:${userId}:1h\``
     - `rateLimitGlobal1m: (uf: string) => \`fiscal-notes:rl:sefaz:global:${uf}:1m\``
     - `circuitBreaker: (uf: string) => \`fiscal-notes:cb:v1:${uf}\``
5. **`api/src/modules/transactions/domain/errors/`**:
   - Adicionar `TransactionTypeDoesNotSupportFiscalNoteError` com `code = 'TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE'` (centralizado em constante e mapeado como `HttpStatus.CONFLICT` no `AppExceptionFilter`).

## 5. Detalhamento Técnico dos Componentes Principais

### 5.1. `FiscalNoteInput` Value Object (Parsing Local + Mod-11 + Anti-SSRF)
Aceita `rawInput: string`:
1. Faz `trim()`; rejeita se vazio ou `> 1024` chars (`FISCAL_NOTE_INVALID_INPUT`).
2. Detecta formato:
   - **URL** (`/^https?:\/\//i`): faz parse via `new URL(trimmed)`.
     - Extrai `hostname` normalizado em minúsculas.
     - Extrai query parameter `p` (case-insensitive search por `p` em `url.searchParams`). Se ausente, lança `FISCAL_NOTE_INVALID_INPUT`.
     - **Nunca** usa a URL para rede; apenas compara `hostname` com allowlist da UF após validar a chave, marcando `unknownHost: string | null` para que o serviço registre log `warn` + alerta `WARN` (`FISCAL_NOTE_UNKNOWN_QR_HOST`).
   - **Payload `p` direto** (contém `|`): usa diretamente como payload pipe-separated.
   - **Chave de 44 dígitos** (fallback): remove tudo que não é dígito (`/\D/g`). Se length === 44, trata como `channel = QRCODE_V3` (`versaoQrcode = '3'`, `tipoAmbiente = '1'`).
3. Para payload pipe-separated (`parts = payload.split('|')`):
   - `chave = parts[0].replace(/\D/g, '')`, `versao = parts[1]`, `ambiente = parts[2]`.
   - Valida `ambiente`: se `=== '2'` → lança `FiscalNoteHomologationNotAllowedError` (`422`); se `!== '1'` → `FiscalNoteInvalidInputError` (`400`).
   - Se `versao === '2'`:
     - 5 campos (emissão normal): `[chave, '2', '1', idCsc, hash]` → `channel = QRCODE_V2`.
     - 8 campos (contingência `tpEmis = 9`): `[chave, '2', '1', diaEmissao, valorTotal, digVal, idCsc, hash]` → `channel = QRCODE_V2` com campos extras de contingência.
     - Qualquer outra quantidade de campos ou campos obrigatórios vazios → `FiscalNoteInvalidInputError`.
   - Se `versao === '3'`:
     - mínimo 3 campos (`[chave, '3', '1', ...]`) → `channel = QRCODE_V3`.
   - Outra versão → `FiscalNoteInvalidInputError`.
4. Validação da `accessKey` de 44 dígitos:
   - Exatamente 44 dígitos `/^[0-9]{44}$/`.
   - Modelo (`slice(20, 22)`): deve ser `'65'` (NFC-e), senão `FiscalNoteInvalidInputError`.
   - Dígito verificador (`slice(43, 44)`): cálculo **módulo 11** sobre os primeiros 43 dígitos com pesos `2..9` da direita para a esquerda; `resto = soma % 11`; `dv = resto === 0 || resto === 1 ? 0 : 11 - resto`. Divergência → `FiscalNoteInvalidInputError`.
   - Extrai `uf = accessKey.slice(0, 2)`.
   - Se `uf` não tem provedor suportado (`uf !== '23'`) → `FiscalNoteUnsupportedUfError` (`422`).
   - Compara `sourceHost` (se veio de URL) com `SEFAZ_CE_ALLOWED_HOSTS` (para `UF = 23`), preenchendo `unknownQrHost` se fora da allowlist.

### 5.2. `SefazCeHttpClient` (Isolamento de `http://`, Limite de 1 MB, Timeout, 1 Retry Transitório)
- Usa exclusivamente `config.sefazCe.baseUrl` (default `http://nfce.sefaz.ce.gov.br`) validado na inicialização (`new URL(baseUrl)` com protocolo `http:` ou `https:`; em produção/default, apenas host configurado).
- Monta payload JSON:
  - `QRCODE_V2`: `{ chave_acesso, versao_qrcode: '2', tipo_ambiente: '1', identificador_csc, codigo_hash, ...(contingência ? { dia_emissao, valor_total, dig_val } : {}) }` → `POST ${baseUrl}/nfce/api/notasFiscal/qrcodev2/`
  - `QRCODE_V3`: `{ chave_acesso, versao_qrcode: '3', tipo_ambiente: '1' }` → `POST ${baseUrl}/nfce/api/notasFiscal/qrcodev3/`
- Headers: `Content-Type: application/json`, `Accept: application/json`, `User-Agent: Danfy-FiscalNotes/1.0`.
- `redirect: 'error'` (impede open redirect / SSRF via 30x!).
- `AbortController` com timeout `config.http.timeoutMs` (padrão `7000 ms`).
- **Limite rígido de 1 MB (`1_048_576` bytes):**
  - Verifica `Content-Length` antes de ler o body; se `> maxResponseBytes`, aborta imediatamente lançando `FiscalNoteResponseTooLargeError`.
  - Lê `response.body` via `ReadableStream` chunk a chunk acumulando `totalBytes`; se `totalBytes > maxResponseBytes`, cancela o reader, chama `controller.abort()` e lança `FiscalNoteResponseTooLargeError`.
- **Retry único controlado:**
  - Máximo 1 retry (total 2 tentativas) com espera de `config.http.retryBackoffMs` (`400 ms`) **somente** para:
    - `AbortError` / timeout;
    - erro de rede (`TypeError` / socket error no `fetch`);
    - HTTP status `502`, `503`, `504`.
  - **Nunca** faz retry em `200` (mesmo com `{ erro: ... }`), `4xx`, `FiscalNoteResponseTooLargeError` ou erro de parsing.

### 5.3. `SefazCeHtmlParser` (`cheerio` + Regras da Pesquisa Real SEFAZ-CE)
- Decodifica entidades HTML no campo `erro` da resposta JSON usando `cheerio.load(...)` (lida com `&aacute` sem ponto e vírgula) e classifica:
  - cancelada / denegada → `FiscalNoteCancelledOrDeniedError` (`422`);
  - homologação → `FiscalNoteHomologationNotAllowedError` (`422`);
  - código `100` / "QR Code Inválido" / "não encontrada" / demais erros de nota inexistente → `FiscalNoteSefazNotFoundError` (`404`).
- No HTML de `{ "xml": "..." }`:
  1. Carrega com `cheerio.load(html)`.
  2. Verifica banners/alertas de status fiscal (ex.: texto indicando "CANCELADA", "DENEGADA", "EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO" / "SEM VALOR FISCAL") → rejeita com `422` (`FiscalNoteCancelledOrDeniedError` ou `FiscalNoteHomologationNotAllowedError`).
  3. **Remove explicitamente** qualquer seção `[data-role="collapsible"]` cujo título `<h4>` contenha `Consumidor` antes de extrair demais dados (defesa em profundidade Zero-PII!).
  4. Extrai emitente:
     - `issuerName`: `#u20` (ou primeiro `div.txtTopo`), normalizando espaços múltiplos.
     - `div.text` seguintes no bloco do emitente: extrai `CNPJ` (14 dígitos após `CNPJ:`) e `issuerAddress` (normalizado, removendo espaços/quebras extras).
  5. Extrai itens (`table#tabResult tr`):
     - para cada linha (`position = index + 1`):
       - `rawDescription`: `span.txtTit` (primeiro span de título do item), normalizado;
       - `storeCode`: `span.RCod` extraindo valor após `Código:` (removendo parênteses; `null` se ausente);
       - `quantity`: `span.Rqtd` parseando número pt-BR (`1.234,567` → `1234.567`), validando `> 0`;
       - `unit`: `span.RUN` extraindo após `UN:` (uppercase/trimmed, default `'UN'` se ausente após prefixo ou rejeita se vazio);
       - `unitPrice`: `span.RvlUnit` parseando número pt-BR (`26,99` → `26.99`), validando `>= 0`;
       - `totalPriceCents`: `td.txtTit.noWrap span.valor` (ou último `span.valor` da linha) convertido exatamente para centavos inteiros (sem ponto flutuante: split em `,`, parte inteira `* 100 +` centavos de 2 dígitos!).
  6. Extrai totais (`#totalNota`):
     - Como a SEFAZ-CE repete `id="linhaTotal"` múltiplas vezes, percorre todos os `div` filhos de `#totalNota` lendo o texto do `<label>` (normalizado sem acentos/lowercase) e o valor de `span.totalNumb`:
       - `valor total` → `grossAmountCents`;
       - `descontos` → `discountAmountCents` (default `0`);
       - `valor a pagar` → `payableAmountCents`;
       - `troco` → se texto for `NaN` (case-insensitive) ou vazio, `changeAmountCents = null`, senão parse para centavos;
       - `tributos totais` (ou `label.txtObs` + `span.totalNumb.txtObs`) → `taxAmountCents` (default `0`).
     - Caso `grossAmountCents` não esteja explícito mas `payableAmountCents` esteja (notas sem desconto onde a SEFAZ omite a linha "Valor total"), deriva `grossAmountCents = payableAmountCents + discountAmountCents`.
  7. Extrai pagamentos (`#linhaForma` e irmãos seguintes antes de `Troco` / `Tributos`):
     - Para cada par `label.tx` + `span.totalNumb` dentro do bloco de forma de pagamento (ignorando rótulos de resumo/troco/tributos), cria `{ position, methodLabel, amountCents }`.
  8. Extrai informações gerais (`[data-role="collapsible"]` com `<h4>` contendo `Informações gerais` ou busca por texto estruturado + `span.chave`):
     - `extractedAccessKey`: `span.chave` removendo tudo que não é dígito;
     - `number` (`Número:`), `series` (`Série:`), `emissao` (`Emissão:` capturando `DD/MM/YYYY HH:mm:ss` com offset opcional `-03:00` — atenção à concatenação na SEFAZ-CE antes de `- Via Consumidor`!), `protocol` (`Protocolo de Autorização:` capturando o número do protocolo antes da data), `xmlVersion` (`Versão XML:`), `xsltVersion` (`Versão XSLT:`).
     - Converte `emissao` em:
       - `issuedDate: DateOnlyString` (`YYYY-MM-DD` da data local extraída diretamente de `DD/MM/YYYY`);
       - `issuedAt: Date` (ISO `YYYY-MM-DDTHH:mm:ss${offset ?? '-03:00'}` convertido para UTC `Date`).
  9. **Validação de integridade obrigatória** (falha lança `FiscalNoteParseFailedError` → `502` + Circuit Breaker + alerta `CRITICAL`):
     - `extractedAccessKey === requestedAccessKey`;
     - `issuerName.length > 0` e `/^[0-9]{14}$/.test(issuerCnpj)`;
     - `number.length > 0`, `series.length > 0`, `issuedAt` válido e `isValidDateOnly(issuedDate)`;
     - `items.length >= 1` com `quantity > 0`, `unitPrice >= 0`, `totalPriceCents >= 0`;
     - todos os centavos inteiros seguros `>= 0`;
     - `Math.abs((grossAmountCents - discountAmountCents) - payableAmountCents) <= 1`.

### 5.4. `CircuitBreakerService` (`api/src/shared/circuit-breaker/`)
- Armazena estado JSON no Redis sob `key` (ex.: `fiscal-notes:cb:v1:23`) com TTL generoso de limpeza (ex.: 24h) para não vazar chaves órfãs:
  ```ts
  interface CircuitBreakerStateRecord {
    state: CircuitBreakerState; // CLOSED | OPEN | HALF_OPEN
    consecutiveFailures: number;
    cooldownStage: number; // 0 -> 60s, 1 -> 120s, 2+ -> 300s
    openedAtMs: number | null;
    nextAttemptAtMs: number | null;
  }
  ```
- API pública:
  - `canExecute(options: CircuitBreakerOptions): Promise<CircuitBreakerDecision>` (`{ allowed: boolean, state, retryAfterSeconds?: number, transitionedTo?: CircuitBreakerState }`);
  - `recordSuccess(options: CircuitBreakerOptions): Promise<{ previousState: CircuitBreakerState; currentState: CircuitBreakerState }>`;
  - `recordFailure(options: CircuitBreakerOptions): Promise<{ previousState: CircuitBreakerState; currentState: CircuitBreakerState; opened: boolean; retryAfterSeconds?: number; consecutiveFailures: number; cooldownStage: number }>`;
  - `releaseProbe(options: CircuitBreakerOptions): Promise<void>`: libera o lock `:probe` e, se o circuito estiver em `HALF_OPEN`, restaura o estado para `OPEN` preservando `consecutiveFailures`, `cooldownStage`, `openedAtMs` e `nextAttemptAtMs` (usado quando uma rejeição prévia de rate limit aborta uma sonda antes de chamar o provedor).
- Comportamento:
  - `CLOSED`: permite execução; falha incrementa `consecutiveFailures`; ao atingir `failureThreshold` (default `5`), transita para `OPEN` com `cooldownStage = 0` (`60s`), `nextAttemptAtMs = now + 60_000`.
  - `OPEN`: enquanto `now < nextAttemptAtMs`, retorna `{ allowed: false, retryAfterSeconds: Math.ceil((nextAttemptAtMs - now) / 1000) }` em `< 5 ms`. Quando `now >= nextAttemptAtMs`, transita atomicamente para `HALF_OPEN` (usando lock/chave auxiliar `SET ... NX EX` curto para permitir sonda única controlada) e permite 1 requisição de sonda.
  - `HALF_OPEN`: se `recordSuccess` → volta para `CLOSED` (`consecutiveFailures = 0`, `cooldownStage = 0`), retornando transição `HALF_OPEN -> CLOSED` (para o chamador disparar alerta `RESOLVED`!). Se `recordFailure` → volta para `OPEN` avançando `cooldownStage = Math.min(stage + 1, cooldownSeconds.length - 1)` (`60s -> 120s -> 300s`).
  - Se o Redis falhar (erro de conexão/timeout), loga `warn` (`CIRCUIT_BREAKER_REDIS_ERROR`) e retorna `{ allowed: true }` (fail-open seguro).

### 5.5. `RedisFiscalNoteRateLimiter` (Camada 2A Usuário + Camada 2B Global UF)
Executado **exclusivamente em cache miss** (após Circuit Breaker aprovar e antes de chamar o provider HTTP):
- Usa script Lua atômico (ou `INCR` + `EXPIRE` condicional quando `count === 1` + `TTL`) para evitar race condition de chave sem TTL:
  1. `fiscal-notes:rl:sefaz:user:{userId}:1m` (janela `60s`, limite configurável default `5`);
  2. `fiscal-notes:rl:sefaz:user:{userId}:1h` (janela `3600s`, limite configurável default `30`);
  3. `fiscal-notes:rl:sefaz:global:{uf}:1m` (janela `60s`, limite configurável default `40`).
- **Importante:** verifica primeiro os limites do usuário (para não queimar a cota global com um usuário abusivo), e só depois incrementa o contador global; se o usuário exceder `1m` ou `1h`, lança `FiscalNoteRateLimitExceededError(retryAfterSeconds)` (`429` + header `Retry-After`).
- Se a cota global da UF exceder `40/min`, dispara alerta `WARN` (`FISCAL_NOTE_SEFAZ_GLOBAL_RL_HIT`) via `OperationalAlertService` e lança `SefazTemporarilyUnavailableError(retryAfterSeconds)` (`503` + header `Retry-After`).
- Se o Redis falhar, loga `warn` e degrada com segurança (fail-open).

### 5.6. `ApplicationError` e `AppExceptionFilter`
- Em `api/src/shared/application/errors/application-error.ts`:
  - adicionar `get details(): Record<string, unknown> | null { return null; }`.
- Em `api/src/common/filters/app-exception.filter.ts`:
  - atualizar `toErrorResponse` para usar `details: exception instanceof ApplicationError ? exception.details : null`;
  - mapear todos os novos códigos em `ERROR_STATUS_BY_CODE` usando as constantes de `FiscalNoteErrorCodes` e `TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE`:
    - `FISCAL_NOTE_INVALID_INPUT`: `400`
    - `INVALID_FISCAL_NOTE`: `400`
    - `FISCAL_NOTE_NOT_FOUND`: `404`
    - `FISCAL_NOTE_SEFAZ_NOT_FOUND`: `404`
    - `FISCAL_NOTE_ALREADY_IMPORTED`: `409`
    - `TRANSACTION_ALREADY_HAS_FISCAL_NOTE`: `409`
    - `TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE`: `409`
    - `FISCAL_NOTE_UNSUPPORTED_UF`: `422`
    - `FISCAL_NOTE_HOMOLOGATION_NOT_ALLOWED`: `422`
    - `FISCAL_NOTE_CANCELLED_OR_DENIED`: `422`
    - `FISCAL_NOTE_RATE_LIMIT_EXCEEDED`: `429`
    - `FISCAL_NOTE_PARSE_FAILED`: `502`
    - `FISCAL_NOTE_RESPONSE_TOO_LARGE`: `502`
    - `SEFAZ_TEMPORARILY_UNAVAILABLE`: `503`
    - `SEFAZ_TIMEOUT`: `504`

## 6. Contrato HTTP (API v1)

Todos os endpoints ficam sob o prefixo global `/api/v1` e herdam `OriginGuard`, `JwtAuthGuard`, `EmailVerificationStatusGuard` e `ThrottlerGuard`.

| Método & Rota | Throttle | Status | Objeto de Resposta | Descrição |
| --- | --- | --- | --- | --- |
| `GET /fiscal-notes` | padrão | `200` | `fiscal_note.list` | Lista paginada leve (`fiscal_note.summary`) das notas ativas do usuário com filtros combináveis (`issuedFrom`/`issuedTo`, `issuerCnpj`, `sourceUf`, `minAmountCents`/`maxAmountCents`, `search`), ordenação allowlisted e `summary` (`fiscal_note.summary_totals`) |
| `GET /fiscal-notes/:id` | padrão | `200` | `fiscal_note.item` | Retorna detalhe completo de uma `FiscalNote` ativa do usuário autenticado por UUID com `items` e `payments` ordenados |
| `POST /fiscal-notes/preview` | `10 / 60s` | `200` | `fiscal_note.preview` | Valida entrada, consulta cache/SEFAZ, retorna prévia sanitizada + `alreadyImported` + `suggestedTransaction` |
| `POST /fiscal-notes/import` | `10 / 60s` | `201` | `fiscal_note.import` | Cria nova `Transaction (EXPENSE)` + `FiscalNote` + itens + pagamentos atomicamente |
| `POST /transactions/:id/fiscal-note` | `10 / 60s` | `201` | `fiscal_note.item` | Vincula `FiscalNote` + itens + pagamentos a uma `EXPENSE` existente sem alterá-la |
| `GET /transactions/:id/fiscal-note` | padrão | `200` | `fiscal_note.item` | Retorna `FiscalNote` ativa da transação com `items` e `payments` ordenados |
| `DELETE /transactions/:id/fiscal-note` | padrão | `204` | — | Soft delete somente da `FiscalNote`, preservando a `Transaction` |

### Alteração Aditiva em `TransactionResponseDto`
- Novo campo: `hasFiscalNote: boolean` (`@ApiProperty({ example: false, description: 'Indica se a transação possui uma nota fiscal ativa vinculada' })`).

## 7. Configuração (`fiscal-notes.config.ts` + Joi + `.env.exemple`)

Todas as variáveis são opcionais com defaults seguros para que nenhum ambiente existente quebre sem configuração manual:

| Variável | Default | Faixa / Validação Joi |
| --- | --- | --- |
| `FISCAL_NOTES_SEFAZ_CE_BASE_URL` | `http://nfce.sefaz.ce.gov.br` | `Joi.string().uri({ scheme: ['http', 'https'] })` |
| `FISCAL_NOTES_HTTP_TIMEOUT_MS` | `7000` | `integer`, min `1000`, max `15000` |
| `FISCAL_NOTES_HTTP_RETRY_BACKOFF_MS` | `400` | `integer`, min `50`, max `3000` |
| `FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES` | `1048576` | `integer`, min `65536`, max `5242880` |
| `FISCAL_NOTES_CACHE_TTL_SECONDS` | `1200` | `integer`, min `60`, max `3600` |
| `FISCAL_NOTES_RL_USER_PER_MINUTE` | `5` | `integer`, min `1`, max `100` |
| `FISCAL_NOTES_RL_USER_PER_HOUR` | `30` | `integer`, min `1`, max `1000` |
| `FISCAL_NOTES_RL_GLOBAL_PER_MINUTE` | `40` | `integer`, min `1`, max `1000` |
| `FISCAL_NOTES_CB_FAILURE_THRESHOLD` | `5` | `integer`, min `1`, max `50` |
| `FISCAL_NOTES_CB_COOLDOWN_SECONDS` | `60,120,300` | lista CSV de inteiros positivos (`>= 5`) |

## 8. Fluxo de Dados Ponta a Ponta (Preview → Import/Link)

```text
Cliente autenticado
  │ POST /api/v1/fiscal-notes/preview { input }
  ▼
FiscalNotesController (@Throttle 10/60s)
  ▼
PreviewFiscalNoteUseCase
  ├── 1. FiscalNoteInput.parse(input)  [validação local: QR v2/v3 ou 44d, mod-11, mod=65, amb=1, UF=23, host allowlist]
  ├── 2. Se unknownQrHost -> log WARN + OperationalAlertService (WARN)
  ├── 3. Consulta duplicidade ativa (userId, accessKey) no PostgreSQL
  ├── 4. FiscalNoteQueryService.resolve(parsedInput, userId):
  │     ├── 4a. Redis GET fiscal-notes:parsed:v1:{accessKey}
  │     │     └── HIT -> métrica cache hit -> retorna ParsedFiscalNoteData (funciona mesmo com CB OPEN)
  │     └── 4b. MISS:
  │           ├── CircuitBreakerService.canExecute(fiscal-notes:cb:v1:23)
  │           │     └── OPEN -> métrica cb_open -> 503 SEFAZ_TEMPORARILY_UNAVAILABLE (Retry-After)
  │           ├── RedisFiscalNoteRateLimiter.consume(userId, uf)
  │           │     ├── user 1m/1h excedido -> 429 FISCAL_NOTE_RATE_LIMIT_EXCEEDED (Retry-After)
  │           │     └── global UF 1m excedido -> alerta WARN + 503 SEFAZ_TEMPORARILY_UNAVAILABLE
  │           ├── SefazCeProvider.fetchAndParse(parsedInput)
  │           │     ├── SefazCeHttpClient (timeout 7s, 1 MB stream cap, 1 retry transitório, sem redirect)
  │           │     ├── SefazCeHtmlParser (cheerio, remove Consumidor, integridade, NaN -> null)
  │           │     ├── Erro de negócio SEFAZ -> NÃO incrementa CB, NÃO faz retry -> 404 / 422
  │           │     ├── Erro de parser -> CB.recordFailure + alerta CRITICAL parser + alerta CRITICAL CB (se abriu) -> 502
  │           │     └── Erro infra/timeout/1MB -> CB.recordFailure + alerta CRITICAL CB (se abriu) -> 502/503/504
  │           ├── Sucesso:
  │           │     ├── CB.recordSuccess -> se transitou HALF_OPEN->CLOSED, alerta RESOLVED CB
  │           │     └── Redis SET fiscal-notes:parsed:v1:{accessKey} EX 1200 (somente JSON sanitizado)
  │           └── Registra métricas de duração e resultado
  └── 5. Retorna 200 fiscal_note.preview (alreadyImported, existingTransactionId, suggestedTransaction, fiscalNote)
```

Na Etapa 2 (`import` ou `link`), o `FiscalNoteQueryService.resolve(...)` é executado **antes** de abrir a transação no PostgreSQL (`dataSource.transaction`), garantindo que nenhuma conexão ou lock de banco fique retido durante I/O HTTP externo.
