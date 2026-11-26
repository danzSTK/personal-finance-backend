---
area: platform
type: spec-tasks
status: completed
issue: 143
---

# Tasks — Fundação Transversal de Observabilidade (#143)

## Wave 1 — Dependências, Configuração e CacheKeys
- [x] 1. Instalar dependências `nestjs-pino`, `pino`, `pino-http` (dependencies) e `pino-pretty` (devDependencies) em `api/package.json`.
- [x] 2. Criar `api/src/config/observability.config.ts` e registrar no `api/src/config/config.module.ts` com validação Joi das variáveis (`LOG_LEVEL`, `TELEGRAM_ALERTS_ENABLED`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALERT_CHAT_ID`, `TELEGRAM_API_BASE_URL`, `TELEGRAM_ALERT_TIMEOUT_MS`, `ALERT_COOLDOWN_CRITICAL_SECONDS`, `ALERT_COOLDOWN_WARN_SECONDS`) + testes unitários.
- [x] 3. Adicionar chaves de observabilidade (`obs:alert:cooldown:{alertKey}` e `obs:metric:{metricName}:{bucket}`) em `api/src/common/utils/cache-keys.factory.ts` e documentar novas variáveis em `.env.exemple`.

## Wave 2 — Núcleo do `ObservabilityModule` (Logging, Contexto, Métricas e Alertas)
- [x] 4. Criar contexto de correlação (`api/src/shared/observability/context/observability-context.ts`) com `AsyncLocalStorage` para `requestId`, `jobId`, `queueName` e `jobName`.
- [x] 5. Criar configuração unificada do Pino (`api/src/shared/observability/logging/pino-logger.config.ts`) com JSON em produção, `pino-pretty` em dev, `X-Request-Id` seguro, `redact` Zero-PII, `sanitizeUrl` e supressão de `/health/*` `200` + testes unitários.
- [x] 6. Criar porta `IMetricsRecorder` e implementação V1 `StructuredLogMetricsRecorder` + testes unitários.
- [x] 7. Criar contratos de alerta (`IOperationalAlertNotifier`), `NoopOperationalAlertNotifier`, `TelegramOperationalAlertNotifier` (usando `fetch` nativo com `AbortSignal.timeout` e sem vazar token) e `OperationalAlertService` (cooldown Redis `SET NX EX`, fallback em memória, `RESOLVED`, `fire-and-forget` isolado) + testes unitários.
- [x] 8. Criar `ObservabilityModule` (`forApi()` e `forWorker()`) e exportar contratos/serviços em `api/src/shared/observability/index.ts`.

## Wave 3 — Integração em API, Worker e Alertas Transversais
- [x] 9. Conectar `ObservabilityModule.forApi()` em `ApiModule` e `app.useLogger(...)` + `{ bufferLogs: true }` + `X-Request-Id` em `cors.exposedHeaders` em `api/src/main.ts`.
- [x] 10. Conectar `ObservabilityModule.forWorker()` em `WorkerModule` e `app.useLogger(...)` + `{ bufferLogs: true }` em `api/src/worker.ts`, e propagar contexto de job (`runWithJobLogContext`) nos processadores BullMQ (`EmailMessageProcessor`, `TransactionAttachmentOptimizationProcessor`).
- [x] 11. Integrar `OperationalAlertService` (via `@Optional()`) no `AppExceptionFilter` (alerta `CRITICAL` em `INTERNAL_SERVER_ERROR` com cooldown por rota normalizada e log estruturado sem `req.body`) e no `AssetReconcilerService` (alerta `CRITICAL` em quarentena), atualizando os testes unitários correspondentes.
- [x] 12. Adicionar testes de integração Redis para cooldown/resolução de alertas e teste E2E validando `X-Request-Id` e `/health/liveness`, garantindo que toda a suíte (`lint:check`, `typecheck`, `test`, `test:integration`, `test:e2e`) passe.

## Wave 4 — Documentação Viva e Skill de Governança (paralelizável com Waves 1–3)
- [x] 13. Criar documentação viva modular em `docs/platform/observability/` (`README.md`, `concepts/logging-and-correlation.md`, `concepts/metrics-and-alerts.md`) e atualizar `docs/platform/README.md` e `docs/configuration.md`.
- [x] 14. Criar a skill `.agents/skills/platform-observability/SKILL.md` (seguindo o padrão de `.agents/skills/platform-errors/SKILL.md`) governando logging estruturado, correlação, Zero-PII, métricas, alertas Telegram e isolamento do `/health`.

## Wave 5 — Revisão, Validação Real de Ambiente e Finalização (Supervisor)
- [x] 15. Revisar todo o diff (aderência arquitetural, segurança, Zero-PII e documentação), validar a API/Worker rodando localmente como cliente real e corrigir quaisquer desvios antes de marcar o PR como pronto para review.
