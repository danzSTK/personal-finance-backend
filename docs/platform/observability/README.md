---
area: platform
type: index
status: current
last_reviewed: 2026-11-26
related:
  - ./concepts/logging-and-correlation.md
  - ./concepts/metrics-and-alerts.md
  - ../README.md
  - ../workers/README.md
  - ../../configuration.md
  - ../../security/README.md
  - ../../notifications/README.md
---

# Observabilidade da Plataforma (Nível 1)

Este contexto documenta a fundação transversal de observabilidade compartilhada pelos dois processos do Danfy Backend (`PROCESS_ROLE=api` e `PROCESS_ROLE=worker`), implementada em `api/src/shared/observability/`.

A arquitetura adota o **Nível 1** de observabilidade: entrega logs estruturados em JSON no `stdout`, correlação ponta a ponta (`requestId` e `jobId`), política estrita **Zero-PII**, porta desacoplada de métricas leves (`IMetricsRecorder`) e alertas operacionais ativos via Telegram Bot API — sem exigir containers adicionais (Prometheus, Loki, Grafana ou Alertmanager) na VPS e mantendo contratos prontos para evolução ao Nível 2.

## Fronteiras Arquiteturais

- **API e Worker unificados:** o módulo global `ObservabilityModule` expõe `ObservabilityModule.forApi()` e `ObservabilityModule.forWorker()`, mantendo separação de papéis (`processRole: 'api' | 'worker'`).
- **Separação de `notifications`:** alertas operacionais de infraestrutura/SRE destinados ao mantenedor via Telegram ficam isolados em `ObservabilityModule` e **nunca** devem ser misturados ao módulo `notifications` (e-mails transacionais de produto via Brevo para usuários finais).
- **Isolamento de `/health`:** integrações externas não críticas (como Telegram Bot API e futuras APIs fiscais) **jamais** entram nos checks de `/health/liveness` ou `/health/readiness`.

## Mapa do Contexto

### Conceitos
- [Logging Estruturado, Correlação e Zero-PII](./concepts/logging-and-correlation.md) — Engine unificada `nestjs-pino`/`pino`, JSON em produção vs `pino-pretty` em dev, contrato de `X-Request-Id`, `AsyncLocalStorage` em jobs BullMQ, redaction global, `sanitizeUrl` e supressão de ruído em `/health/*`.
- [Métricas Leves e Alertas Operacionais](./concepts/metrics-and-alerts.md) — Porta `IMetricsRecorder` (`StructuredLogMetricsRecorder`), `OperationalAlertService`, Telegram Bot API, cooldown distribuído em Redis com fallback em memória, fluxo `RESOLVED`, isolamento `fire-and-forget`, taxonomia de `alertKey` e proteção de `/health`.

### Referências Relacionadas
- [Configuração por variáveis de ambiente](../../configuration.md) — Parâmetros `LOG_LEVEL`, `TELEGRAM_*` e `ALERT_COOLDOWN_*`.
- [Baseline de segurança](../../security/README.md) — Higiene de segredos e proibição de exposição de dados sensíveis em logs e payloads.
- [Workers e processamento assíncrono](../workers/README.md) — Contexto de execução de jobs BullMQ e operações do Worker.
- [Notificações transacionais](../../notifications/README.md) — Domínio de comunicação com usuários finais (separado de alertas operacionais).

## Responsabilidade da Pasta

Consulte esta pasta quando a tarefa envolver:
- Emissão de logs estruturados, correlação de requisições HTTP (`X-Request-Id`) ou jobs BullMQ (`runWithJobLogContext`).
- Revisão de política Zero-PII, `redact` ou sanitização de URLs em logs.
- Instrumentação de contadores/durações via `IMetricsRecorder` (`METRICS_RECORDER`).
- Criação ou ajuste de alertas operacionais via `OperationalAlertService` (`alertKey`, severidades e cooldown).
- Configuração de observabilidade e alertas via Telegram por ambiente.

## Métricas e Alertas Registrados por Domínio

### `fiscal-notes` (SEFAZ-CE)

O módulo `fiscal-notes` instrumenta métricas via `IMetricsRecorder` e alertas operacionais via `OperationalAlertService` sem jamais incluir dados de `Consumidor`, HTML bruto ou chave de acesso completa (apenas `uf` e `maskAccessKeyForLog`):

- **Métricas (`FiscalNoteMetricNames`):**
  - `fiscal_notes.sefaz.query.total` (`uf`, `channel`, `outcome`)
  - `fiscal_notes.sefaz.query.duration_ms` (`uf`, `channel`, `outcome`)
  - `fiscal_notes.cache.lookup.total` (`uf`, `result`: `'hit' | 'miss'`)
  - `fiscal_notes.operations.total` (`operation`: `'preview' | 'import' | 'link' | 'get' | 'unlink'`)
- **Alertas Operacionais (`FiscalNoteLogEvents` / `FiscalNoteAlertKeys`):**
  - `FISCAL_NOTE_SEFAZ_CB_OPENED` (`CRITICAL`, chave `fiscal-notes:sefaz:cb:{uf}`) — abertura do Circuit Breaker da UF após falhas consecutivas de infraestrutura ou parser.
  - `FISCAL_NOTE_SEFAZ_CB_CLOSED` (`RESOLVED`, chave `fiscal-notes:sefaz:cb:{uf}`) — recuperação do Circuit Breaker na transição para `CLOSED`.
  - `FISCAL_NOTE_SEFAZ_PARSER_FAILURE` (`CRITICAL`, chave `fiscal-notes:sefaz:parser:{uf}`) — falha estrutural ou de integridade no parser HTML da SEFAZ.
  - `FISCAL_NOTE_SEFAZ_GLOBAL_RL_HIT` (`WARN`, chave `fiscal-notes:sefaz:global-rl:{uf}`) — cota global por minuto da UF atingida em cache miss.
  - `FISCAL_NOTE_UNKNOWN_QR_HOST` (`WARN`, chave `fiscal-notes:qr:unknown-host:{uf}`, com `host` em `metadata`) — URL de QR Code com host fora da allowlist (requisição externa bloqueada pelo backend).
- **Isolamento de `/health`:** o status do Circuit Breaker e a disponibilidade da SEFAZ **nunca** entram em `/health/liveness` ou `/health/readiness`.
