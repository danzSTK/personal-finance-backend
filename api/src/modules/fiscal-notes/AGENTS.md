# Módulo Fiscal Notes — Instruções Locais

Este módulo implementa a leitura, validação local, consulta resiliente à SEFAZ (V1: SEFAZ-CE `UF = 23`), parsing sanitizado e persistência de NFC-e (modelo `65`) vinculada a despesas (`EXPENSE`).

## Documentação Obrigatória

Antes de planejar ou alterar código neste módulo, leia:

- `docs/fiscal-notes/README.md` — Índice e mapa da documentação viva do módulo.
- `docs/architecture/module-boundaries.md` — Fronteira acíclica `FiscalNotesCoreModule` / `TransactionsModule`.
- `docs/platform/observability/README.md` — Métricas leves (`IMetricsRecorder`), alertas Telegram (`OperationalAlertService`) e isolamento de `/health`.
- `docs/database/schema.md` — Tabelas `fiscal_notes`, `fiscal_note_items` e `fiscal_note_payments`.

## Regras de Domínio e Invariantes

- **LGPD e Zero-PII:** Nunca persista HTML/XML bruto da SEFAZ (PostgreSQL, Redis, R2 ou logs). O parser (`SefazCeHtmlParser`) deve sempre remover o bloco `Consumidor` antes de extrair dados. Nunca logue payload completo de QR Code, CNPJ cru ou chave completa fora de `maskAccessKeyForLog()`.
- **Proteção Anti-SSRF e Isolamento de `http://`:** Nunca faça requisições HTTP para URLs enviadas pelo cliente. Extraia apenas o parâmetro `p` localmente no `FiscalNoteInput`, valide o host contra `FISCAL_NOTE_ALLOWED_HOSTS_BY_UF` e isole chamadas `http://` exclusivamente em `SefazCeHttpClient` com `redirect: 'error'`, timeout e limite rígido de 1 MB.
- **Zero Magic Strings:** Centralize códigos de erro, UFs, eventos de log, métricas, chaves de alerta, constraints DB e constantes de parser em `api/src/modules/fiscal-notes/domain/constants/fiscal-notes.constants.ts`, `RESPONSE_OBJECT_TYPES` e `CacheKeys.fiscalNotes`.
- **Fronteira Acíclica com `transactions`:** `FiscalNotesCoreModule` **não** pode importar `TransactionsModule`; comunique-se exclusivamente via `FiscalNoteTransactionLifecyclePort` e `TransactionFiscalNotePort`. Nunca mantenha transação PostgreSQL aberta durante chamadas HTTP externas (`FiscalNoteQueryService.resolve` roda sempre antes de `dataSource.transaction`).
- **Precisão Monetária e Temporal:** Valores monetários (`*_amount_cents`, `total_price_cents`) usam inteiros seguros em centavos (`bigint`). `quantity` e `unit_price` usam `NUMERIC(12, 4)`. Separe `issuedDate` (`DateOnly` local da emissão) de `issuedAt` (`Instant` UTC com offset `-03:00`).
- **Isolamento de `/health`:** Nunca adicione indicadores de saúde da SEFAZ ou do Circuit Breaker em `/health/liveness` ou `/health/readiness`.
