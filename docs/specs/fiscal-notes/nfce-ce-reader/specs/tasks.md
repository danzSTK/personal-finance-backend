---
area: fiscal-notes
type: spec-tasks
status: in_progress
issue: 144
---

# Tasks — Leitura e Importação de NFC-e (SEFAZ-CE)

## Wave 0 — Spec e Branch
- [x] Criar branch `feat/144-fiscal-notes-nfce-ce` a partir de `origin/develop`
- [x] Escrever `requirements.md`, `design.md`, `tasks.md` e `decisions.md`
- [x] Atualizar `docs/specs/README.md`
- [ ] Commitar spec, fazer push e abrir Draft PR mirando `develop` (`Closes #144`)

## Wave 1 — Fundação Compartilhada, Dependência, Config e Contratos Base
- [ ] Instalar dependência `cheerio` em `api/package.json` (`package-lock.json` em `api/`)
- [ ] Implementar `CircuitBreakerModule` e `CircuitBreakerService` reutilizáveis em `api/src/shared/circuit-breaker/` + testes unitários
- [ ] Estender `ApplicationError` com `details` opcional (`null` por padrão) e atualizar `AppExceptionFilter` + mapeamento dos novos códigos de erro
- [ ] Adicionar `RESPONSE_OBJECT_TYPES` (`FISCAL_NOTE_PREVIEW`, `FISCAL_NOTE_IMPORT`, `FISCAL_NOTE_ITEM`) em `api/src/common/models/constants/response-object.constants.ts`
- [ ] Adicionar chaves `CacheKeys.fiscalNotes.*` em `api/src/common/utils/cache-keys.factory.ts`
- [ ] Criar `api/src/config/fiscal-notes.config.ts` + schema Joi em `api/src/config/config.module.ts` + testes unitários + variáveis em `.env.exemple`

## Wave 2 — Persistência (Migration + ORM + Repositórios) e Domínio/Infra `fiscal-notes`
- [ ] Criar migration `1789000000000-CreateFiscalNotesTables.ts` (tabelas `fiscal_notes`, `fiscal_note_items`, `fiscal_note_payments`, constraints, índices parciais, FK indexes, trigger `set_updated_at()`)
- [ ] Criar ORM entities (`FiscalNoteOrmEntity`, `FiscalNoteItemOrmEntity`, `FiscalNotePaymentOrmEntity`) e registrá-las em `api/src/config/entities.ts`
- [ ] Criar domínio de `fiscal-notes`: constantes (zero magic strings), `FiscalNoteInput` VO (QR v2 normal/contingência, QR v3, chave 44d, mod-11, allowlist host), entidades (`FiscalNote`, `FiscalNoteItem`, `FiscalNotePayment`), erros de domínio/aplicação, `IFiscalNoteRepository`
- [ ] Implementar `FiscalNoteRepository`, `FiscalNoteMapper`, `FiscalNoteTransactionLifecycleAdapter` e `FiscalNotesCoreModule`
- [ ] Implementar `SefazCeHttpClient` (timeout, 1 MB streaming cap, 1 retry transitório, sem redirect, allowlist base URL), `SefazCeHtmlParser` (`cheerio`, descarte `Consumidor`, `NaN -> null`, validação de integridade + fixtures sanitizadas), `SefazCeProvider`, `FiscalNoteProviderRegistry`
- [ ] Implementar `RedisFiscalNoteCache`, `RedisFiscalNoteRateLimiter` (usuário 5/min, 30/h + global UF 40/min) e `FiscalNoteQueryService` (integrando cache, CB, rate limit, `IMetricsRecorder` e `OperationalAlertService`)

## Wave 3 — Use Cases, Controllers HTTP e Integração com `transactions`
- [ ] Implementar use cases de `fiscal-notes`: `PreviewFiscalNoteUseCase`, `ImportFiscalNoteUseCase`, `LinkFiscalNoteUseCase`, `GetTransactionFiscalNoteUseCase`, `UnlinkTransactionFiscalNoteUseCase`
- [ ] Integrar `TransactionsModule` com `FiscalNotesCoreModule`:
  - adicionar `hasFiscalNote` em `Transaction` e `TransactionResponseDto` (sem N+1 em `ListTransactionsUseCase`, e populado em `Get`, `Update`, `Confirm`, `Create`);
  - sincronizar soft delete em `DeleteTransactionUseCase` na mesma transação PostgreSQL;
  - bloquear mudança de `type` para não-`EXPENSE` com nota ativa em `UpdateTransactionUseCase` e `ConfirmTransactionUseCase` (`409 TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE`);
  - implementar e exportar `TransactionFiscalNotePort` para `FiscalNotesModule`
- [ ] Implementar `FiscalNotesController`, `TransactionFiscalNoteController`, DTOs com Swagger/class-validator e registrar `FiscalNotesModule` em `ApiModule`

## Wave 4 — Testes Unitários, E2E e Integração
- [ ] Testes unitários completos (VO/mod-11, parser HTML com fixtures reais sanitizadas + bloco Consumidor + `NaN` + cancelada + quebrada, HTTP client 1 MB/timeout/retry, Circuit Breaker progressivo, rate limiter 2 camadas, query service, todos os use cases de `fiscal-notes` e testes atualizados de `transactions`)
- [ ] Testes E2E HTTP em `api/test/fiscal-notes.e2e-spec.ts` cobrindo contrato HTTP, status codes, `details` de conflito `409`, `Retry-After` em `429`/`503`, `hasFiscalNote`, validação DTO e isolamento de `/health`
- [ ] Testes de integração reais em `api/test/fiscal-notes.integration-spec.ts` (Testcontainers PostgreSQL + Redis + servidor HTTP stub local simulando SEFAZ-CE) validando migration up/down, índices únicos parciais, multi-tenancy, concorrência `23505`, soft delete sincronizado, cache hit com CB aberto, rate limits reais no Redis e abertura/recuperação do Circuit Breaker

## Wave 5 — Documentação Viva e Governança
- [ ] Criar documentação viva em `docs/fiscal-notes/` (`README.md`, `concepts/`, `flows/`, `decisions/`, `references/`) e `api/src/modules/fiscal-notes/AGENTS.md`
- [ ] Atualizar `docs/database/schema.md`, `docs/configuration.md`, `docs/architecture/module-boundaries.md`, `docs/platform/response-objects/README.md`, `docs/platform/observability/README.md`, `docs/errors/` e `docs/tests/README.md` (ou docs equivalentes existentes)

## Wave 6 — Revisão, Validação Real e Finalização
- [ ] Revisão completa (`danfy-review`, `database-review`, `migration-rollout`, `security-review`, `platform-errors`, `platform-observability`, `test-suite-governance` e auditoria de magic strings)
- [ ] Rodar migration e testar a API real localmente contra a NFC-e real da SEFAZ-CE como cliente autenticado (preview QR Code + preview chave 44d + import + list/get `hasFiscalNote` + 409 duplicada + unlink + link em despesa existente + soft delete sincronizado + logs Zero-PII + `/health`)
- [ ] Rodar todos os checks de CI em Node 24 (`format:check`, `lint:check`, `typecheck`, `build`, `test`, `test:e2e`, `test:integration`)
- [ ] Atualizar checklist final, fazer push e marcar PR pronta para review
