---
area: fiscal-notes
type: index
status: current
last_reviewed: 2026-11-26
related:
  - ../README.md
  - ../transactions/README.md
  - ../architecture/module-boundaries.md
  - ../database/schema.md
  - ../platform/observability/README.md
---

# Fiscal Notes

`fiscal-notes` é o módulo responsável pela leitura, validação, consulta externa resiliente, sanitização LGPD e persistência de **NFC-e** (Nota Fiscal de Consumidor Eletrônica, modelo `65`) vinculada a despesas (`EXPENSE`) na plataforma Danfy.

O fluxo ocorre em duas etapas explícitas via HTTP autenticado: primeiro o usuário pré-visualiza a nota (a partir da URL/payload do QR Code ou da chave de acesso de 44 dígitos) para inspecionar estabelecimento, itens, pagamentos, status de duplicidade e transação sugerida; em seguida, confirma a importação criando uma nova despesa atomicamente ou vincula a nota a uma despesa existente sem sobrescrever os valores financeiros já registrados pelo usuário.

Arquiteturalmente, o módulo preserva duas fronteiras estritas: (1) desacoplamento acíclico com `transactions` por meio de `FiscalNotesCoreModule` e portas bidirecionais de aplicação, mantendo I/O HTTP externo sempre fora de transações PostgreSQL; e (2) política **Zero-PII / LGPD**, descartando integralmente dados do bloco `Consumidor` e jamais armazenando HTML/XML bruto da SEFAZ. A arquitetura de provedores é plugável por UF (`IFiscalNoteProvider` + `IFiscalNoteProviderRegistry`), iniciando pela **SEFAZ-CE (`UF = 23`)**.

## Mapa da Documentação

### Conceitos
- [Fiscal Note Aggregate](./concepts/fiscal-note-aggregate.md) — Agregado `FiscalNote` + `FiscalNoteItem` + `FiscalNotePayment`, ownership multi-tenant, LGPD/Zero-PII, precisão `bigint` vs `numeric(12, 4)` e datas civis vs instantes.
- [Input and Provider Strategy](./concepts/input-and-provider-strategy.md) — Value Object `FiscalNoteInput`, formatos de QR Code v2/v3 e chave de 44 dígitos, cálculo módulo 11, allowlist anti-SSRF e estratégia multi-UF.

### Fluxos
- [Preview and Resilience](./flows/preview-and-resilience.md) — Fluxo de pré-visualização, cache hit com bypass do Circuit Breaker, rate limiter em 2 camadas no Redis, Circuit Breaker progressivo, retry transitório, limite de 1 MB e observabilidade.
- [Import, Link and Lifecycle](./flows/import-link-and-lifecycle.md) — Importação atômica, vínculo em despesa existente sem sobrescrita, consulta, desvínculo via soft delete, concorrência `23505` e ciclo de vida sincronizado com `transactions`.

### Decisões
- [HTML Scraping SEFAZ-CE Without Raw Storage](./decisions/html-scraping-sefaz-ce-without-raw-storage.md) — Uso de `cheerio/slim` sobre HTML da SEFAZ-CE sem armazenar HTML bruto nem dados de consumidor, e exclusão da NF-e modelo `55` no MVP.
- [Fiscal Notes Core Module Boundary](./decisions/fiscal-notes-core-module-boundary.md) — Separação `FiscalNotesCoreModule` vs `FiscalNotesModule` e portas bidirecionais para manter o grafo acíclico com `TransactionsModule`.
- [Reusable Redis Circuit Breaker](./decisions/reusable-redis-circuit-breaker.md) — Circuit Breaker distribuído no Redis com cooldown progressivo em `shared/circuit-breaker`, fail-open e isolado de `/health`.

### Referência
- [HTTP and Error Contracts](./reference/http-and-error-contracts.md) — Endpoints, discriminadores `object`, códigos de erro de domínio/aplicação, `details` de `409` e header `Retry-After`.
- [Redis Keys and Limits](./reference/redis-keys-and-limits.md) — Chaves `CacheKeys.fiscalNotes.*`, lock de sonda do Circuit Breaker, janelas Lua de rate limit, TTLs e variáveis `FISCAL_NOTES_*`.

## Estado Atual de Implementação

### Implementado
- [x] `CircuitBreakerModule` e `CircuitBreakerService` distribuídos no Redis (`api/src/shared/circuit-breaker/`).
- [x] Migration `1789000000000-CreateFiscalNotesTables.ts` com `fiscal_notes`, `fiscal_note_items` e `fiscal_note_payments`.
- [x] Domínio (`FiscalNote`, `FiscalNoteItem`, `FiscalNotePayment`, `FiscalNoteInput` com mod-11 e anti-SSRF).
- [x] Provedor `SefazCeProvider` (`SefazCeHttpClient` + `SefazCeHtmlParser` com `cheerio/slim`) e `FiscalNoteProviderRegistry`.
- [x] Cache Redis (`RedisFiscalNoteCache`), rate limiter Lua (`RedisFiscalNoteRateLimiter`) e `FiscalNoteQueryService` com métricas e alertas.
- [x] Casos de uso (`Preview`, `Import`, `Link`, `Get`, `Unlink`) e controllers HTTP em `/api/v1/fiscal-notes/*` e `/api/v1/transactions/:id/fiscal-note`.
- [x] Integração com `transactions` (`hasFiscalNote`, soft delete sincronizado na mesma transação e bloqueio de troca de `type`).
- [x] Suítes automatizadas unitárias, E2E (`api/test/fiscal-notes.e2e-spec.ts`) e de integração (`api/test/fiscal-notes.integration-spec.ts`).

### Pendente
- [ ] Expansão futura de provedores para outras UFs além do Ceará (`UF = 23`).
