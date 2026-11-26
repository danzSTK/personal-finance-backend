---
area: platform
type: spec-decisions
status: approved
issue: 143
---

# Decisions — Fundação Transversal de Observabilidade (#143)

## DEC-001 — Adotar observabilidade Nível 1 na V1 (zero container novo na VPS)

Status: accepted

Decision:
Entregar logs estruturados JSON no `stdout`, correlação ponta a ponta, porta de métricas leves e alertas via Telegram Bot API sem adicionar containers de Grafana, Loki ou Prometheus na VPS na V1.

Reason:
Reduz custo operacional e consumo de RAM/disco na `vps1` enquanto entrega 100% da visibilidade e proatividade necessárias para o `fiscal-notes` e para a plataforma. As portas (`IMetricsRecorder`, JSON estruturado) já deixam o Nível 2 plugável sem refatoração.

Impact:
Nenhum serviço adicional no `docker-compose` nesta entrega.

## DEC-002 — Adotar `pino` + `nestjs-pino` unificado para API e Worker

Status: accepted

Decision:
Utilizar `pino` via `nestjs-pino` como engine de logging de ambos os processos, conectado via `app.useLogger(...)`.

Reason:
Baixo overhead no Event Loop, JSON nativo em produção, `pino-pretty` em dev, `redact` integrado e compatibilidade total com todas as chamadas `new Logger(...)` já existentes no codebase.

Impact:
Adição de `nestjs-pino`, `pino`, `pino-http` em `dependencies` e `pino-pretty` em `devDependencies`.

## DEC-003 — Separar alertas operacionais (Telegram) do módulo `notifications`

Status: accepted

Decision:
Manter `OperationalAlertService` e `TelegramOperationalAlertNotifier` em `api/src/shared/observability/`, completamente separados de `api/src/modules/notifications/`.

Reason:
`notifications` pertence ao domínio de produto (comunicação com usuários finais via Brevo). Alertas operacionais/SRE pertencem à infraestrutura da plataforma e possuem regras distintas de cooldown, isolamento de falha e destinatário.

Impact:
Nenhuma alteração no módulo `notifications` ou nos pipelines de e-mail transacional.

## DEC-004 — Isolamento estrito de falhas do Telegram e fallback de cooldown

Status: accepted

Decision:
Executar envios ao Telegram em modo `fire-and-forget` com timeout rígido (padrão 4s) e cooldown no Redis (`SET NX EX`), com fallback em memória caso o Redis esteja indisponível.

Reason:
Um canal de alerta operacional nunca pode degradar latência ou derrubar requisições de negócio ou jobs do Worker, nem gerar flood no celular durante falhas de Redis.

Impact:
Falhas do Telegram geram apenas log `warn` local; testes automatizados (`NODE_ENV=test`) usam `NoopOperationalAlertNotifier`.

## DEC-005 — Manter `@Optional()` nas injeções de alerta em `AppExceptionFilter` e `AssetReconcilerService`

Status: accepted

Decision:
Injetar `OperationalAlertService` com `@Optional()` em `AppExceptionFilter` e `AssetReconcilerService`.

Reason:
Preserva 100% de retrocompatibilidade com testes unitários existentes que instanciam `new AppExceptionFilter()` diretamente, enquanto em runtime o `ObservabilityModule` global injeta o serviço automaticamente.

Impact:
Zero quebra de testes existentes; novos casos de teste validam explicitamente a interação com `OperationalAlertService`.

## DEC-006 — Nunca acoplar dependências externas não críticas ao `/health`

Status: accepted

Decision:
Telegram e futuras APIs fiscais (como a SEFAZ) nunca serão adicionados aos indicadores de `/health/liveness` ou `/health/readiness`.

Reason:
Quedas de provedores não críticos não tornam a API do Danfy indisponível e não devem causar reinício de containers pelo orquestrador.

Impact:
`HealthController` permanece validando apenas recursos críticos (`postgres`, `memory_heap`, `redis`).
