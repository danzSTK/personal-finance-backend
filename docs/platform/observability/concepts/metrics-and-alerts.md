---
area: platform
type: concept
status: current
last_reviewed: 2026-11-26
related:
  - ../README.md
  - ./logging-and-correlation.md
  - ../../workers/README.md
  - ../../email/README.md
  - ../../../configuration.md
  - ../../../notifications/README.md
  - ../../../security/README.md
---

# Métricas Leves e Alertas Operacionais

A camada de métricas leves e alertas operacionais da Danfy fornece visibilidade quantitativa e notificação proativa ao mantenedor sem acoplar a aplicação a servidores de métricas pesados no Nível 1 e sem comprometer a disponibilidade da API ou do Worker.

## Métricas Leves (`IMetricsRecorder`)

### Contrato e Abstração

A porta `IMetricsRecorder` (definida em `api/src/shared/observability/contracts/metrics-recorder.interface.ts` e injetada pelo token `METRICS_RECORDER = Symbol('METRICS_RECORDER')`) desacopla os módulos de negócio de qualquer backend de telemetria:

- `incrementCounter(name: string, labels?: MetricLabels, value?: number): void`
- `observeDuration(name: string, durationMs: number, labels?: MetricLabels): void`

Onde `MetricLabels = Record<string, string | number | boolean>`.

### Implementação V1 e Evolução para Nível 2

- **V1 (`StructuredLogMetricsRecorder`):** implementado em `api/src/shared/observability/metrics/structured-log-metrics.recorder.ts`. Emite logs estruturados com `{ event: 'METRIC_RECORDED', metricType: 'counter' | 'histogram', metricName, value, labels }` protegido por `try/catch` para nunca lançar exceções aos chamadores. O namespace `CacheKeys.observability.metricCounter(metricName, bucket)` (`obs:metric:{metricName}:{bucket}`) também fica reservado para contadores agregados opcionais em Redis.
- **Evolução para Nível 2:** quando houver Prometheus/Grafana ou OpenTelemetry, basta plugar uma implementação como `PrometheusMetricsRecorder` (`prom-client`) no token `METRICS_RECORDER` dentro de `ObservabilityModule`, sem alterar nenhum caso de uso ou processador de fila.
- **Cardinalidade controlada:** `labels` devem conter apenas dimensões de baixa cardinalidade (ex.: `queueName`, `status`, `provider`, `outcome`), nunca `userId`, `requestId`, `cpf`, `cnpj` ou URLs com parâmetros variáveis.

## Separação Entre `ObservabilityModule` e `notifications`

A plataforma mantém fronteira rígida entre dois mecanismos que usam canais externos distintos:

| Aspecto | `ObservabilityModule` (`api/src/shared/observability/`) | `notifications` (`api/src/modules/notifications/`) |
| --- | --- | --- |
| Público-alvo | Mantenedor / operação (SRE) | Usuário final do produto |
| Canal | Telegram Bot API | E-mail transacional (Brevo) |
| Persistência e garantia | Best-effort `fire-and-forget` + cooldown em Redis | Transactional Outbox + `email_messages` no PostgreSQL |
| Motivo de disparo | Falhas operacionais inesperadas e anomalias sistêmicas | Eventos de domínio/conta (boas-vindas, verificação, senha) |

Alertas operacionais **nunca** devem ser roteados pelo módulo `notifications` nem gravados em `email_messages`.

## Arquitetura de Alertas Operacionais

Os componentes residem em `api/src/shared/observability/alerts/` e contratos em `api/src/shared/observability/contracts/operational-alert-notifier.interface.ts`:

- **`OPERATIONAL_ALERT_NOTIFIER` (`Symbol('OPERATIONAL_ALERT_NOTIFIER')`):** token DI para o canal de entrega.
- **`IOperationalAlertNotifier`:** contrato com `send(alert: FormattedOperationalAlert): Promise<void>`.
- **`OperationalAlertService`:** serviço transversal injetável em API e Worker que enriquece, deduplica e despacha alertas de forma isolada.
- **`TelegramOperationalAlertNotifier`:** adapter que envia mensagens via `fetch` nativo para `${baseUrl}/bot${token}/sendMessage` com `AbortSignal.timeout(timeoutMs)` (padrão `4000ms`, intervalo `1000–10000ms`) e `disable_web_page_preview: true`.
- **`NoopOperationalAlertNotifier`:** adapter silencioso usado quando alertas estão desativados ou em ambiente de teste.

### Contrato de Entrada e Enriquecimento

`OperationalAlertInput` recebe:

- `alertKey`: chave determinística e de baixa cardinalidade para deduplicação;
- `event`: identificador estável do evento (ex.: `UNHANDLED_HTTP_EXCEPTION`, `ASSET_DELETE_QUARANTINED`);
- `severity`: `'CRITICAL' | 'WARN' | 'RESOLVED'`;
- `title` e `summary`: resumo legível **sem PII**;
- `metadata?`, `cooldownSeconds?`, `requestId?`, `jobId?`.

Antes do envio, `OperationalAlertService` enriquece o payload para `FormattedOperationalAlert` com `environment` (`PROD` | `STAGING` | `DEV` | `TEST`), `processRole` (`api` | `worker`), `timestamp` ISO 8601 e `requestId`/`jobId` capturados automaticamente do `AsyncLocalStorage` quando omitidos.

## Regra de Ativação Segura

A seleção do notifier no boot segue regras estritas de segurança operacional:

1. **`NODE_ENV=test`:** resolve **sempre** para `NoopOperationalAlertNotifier` (testes automatizados nunca disparam chamadas reais à Telegram Bot API; apenas testes unitários dedicados instanciam `TelegramOperationalAlertNotifier` diretamente com `fetch` mockado).
2. **Fora de `test` com `TELEGRAM_ALERTS_ENABLED=true` e credenciais válidas (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_ALERT_CHAT_ID` preenchidos):** ativa `TelegramOperationalAlertNotifier`.
3. **Fora de `test` com `TELEGRAM_ALERTS_ENABLED=false` ou credenciais ausentes:** resolve para `NoopOperationalAlertNotifier`. Se `TELEGRAM_ALERTS_ENABLED=true` estiver ativo sem token ou `chatId`, o sistema emite um log `warn` no boot e faz fallback seguro para `NoopOperationalAlertNotifier`, **nunca** impedindo a inicialização da API ou do Worker.

## Cooldown Distribuído, `RESOLVED` e Isolamento

### Deduplicação no Redis e Fallback em Memória

Para evitar tempestades de alertas no celular do mantenedor:

- A chave Redis é padronizada por `CacheKeys.observability.alertCooldown(alertKey)` → `obs:alert:cooldown:{alertKey}`.
- Para `CRITICAL` (padrão `900s` via `ALERT_COOLDOWN_CRITICAL_SECONDS`) e `WARN` (padrão `1800s` via `ALERT_COOLDOWN_WARN_SECONDS`), o serviço executa aquisição atômica com `SET obs:alert:cooldown:{alertKey} 1 EX <ttlSeconds> NX`:
  - Se o Redis retornar `null` (chave já ativa), o envio ao Telegram é suprimido e registrado em log estruturado com `{ event: 'OPERATIONAL_ALERT_SUPPRESSED', alertKey, severity }`.
  - Se o Redis estiver indisponível, o serviço emite `warn` (`OPERATIONAL_ALERT_COOLDOWN_REDIS_ERROR`) e aplica um fallback local em memória (`Map<string, number>` com TTL) para evitar flood até o Redis se recuperar — sem lançar exceções ao chamador.
- Para `RESOLVED`, o serviço remove a chave `obs:alert:cooldown:{alertKey}` via `del` (protegido por `try/catch`) e envia a notificação de recuperação imediatamente, sem ser bloqueado pelo cooldown anterior.

### Isolamento `fire-and-forget` e Proteção de Segredos

- `OperationalAlertService.notify(input)` agenda o envio assíncrono (`void this.dispatch(alert)`) e retorna `void` imediatamente (`notifyAsync` fica disponível para testes determinísticos).
- Toda chamada de entrega ao notifier roda dentro de `try/catch`; em falha de rede, timeout ou resposta HTTP `>= 400`, apenas um log `warn` (`OPERATIONAL_ALERT_DELIVERY_FAILED`) é emitido — a requisição HTTP ou o job do Worker **nunca** falha nem sofre atraso perceptível.
- Quando `!response.ok` na chamada ao Telegram, o erro interno registra apenas o `status` HTTP e **nunca** inclui `TELEGRAM_BOT_TOKEN` na URL ou na mensagem de erro.

## Taxonomia de Severidades, `alertKey` e Gatilhos

### Severidades

| Severidade | Quando usar | Cooldown padrão |
| --- | --- | --- |
| `CRITICAL` | Falhas internas inesperadas ou perda operacional imediata que exige ação do mantenedor (ex.: HTTP 500, quarentena de asset, quebra de parser/integração crítica). | `900s` (15 min) |
| `WARN` | Degradação parcial ou anomalia recorrente não fatal que exige acompanhamento sem urgência imediata. | `1800s` (30 min) |
| `RESOLVED` | Recuperação explícita de uma condição anteriormente alertada pela mesma `alertKey`. | Limpa o cooldown e envia |

**Regra negativa:** erros `4xx` esperados de negócio, validação, autenticação ou autorização (`DomainError`, `ApplicationError`, `VALIDATION_ERROR`, `401`, `403`, `404`, `409`, `429`) **nunca** devem disparar alertas operacionais.

### Padrão de `alertKey`

Use chaves hierárquicas estáveis e de **baixa cardinalidade** (`<processRole>:<modulo-ou-componente>:<condicao>:<alvo-normalizado>`):

- **Incluídos na V1:**
  - `AppExceptionFilter` (injetando `@Optional() OperationalAlertService`): apenas quando `statusCode === 500 && code === 'INTERNAL_SERVER_ERROR'`, registra log `error` (`UNHANDLED_HTTP_EXCEPTION`, sem `req.body`) e dispara `CRITICAL` com `alertKey` `api:http-500:{METHOD}:{NORMALIZED_ROUTE}` (usando `req.route?.path` + `req.baseUrl` ou pathname sanitizado truncado a 120 chars, evitando explosão de chaves no Redis).
  - `AssetReconcilerService` (injetando `@Optional() OperationalAlertService`): quando `quarantined === true`, preserva o log `[ASSET_DELETE_QUARANTINED]` e dispara `CRITICAL` com `alertKey` `worker:asset-reconciler:quarantine:{assetId}` (`event: 'ASSET_DELETE_QUARANTINED'`).
- **Futuros domínios (ex.: `fiscal-notes`):** devem seguir o mesmo padrão de baixa cardinalidade (ex.: `worker:fiscal-notes:sefaz-ce:parser-broken`, `worker:fiscal-notes:dlq-spike`), sempre sem PII no título, resumo ou metadados.

## Isolamento Total do `/health`

`api/src/modules/health/health.controller.ts` verifica exclusivamente recursos locais críticos da própria aplicação:

- `/health/liveness`: probe leve sem dependências externas.
- `/health/readiness`: `postgres`, `memory_heap` e `redis`.

**Regra inviolável:** o Telegram Bot API e quaisquer integrações externas não críticas (como serviços fiscais da SEFAZ) **jamais** devem ser adicionados como health indicators de `/health/liveness` ou `/health/readiness`. Indisponibilidade de terceiros não torna a API da Danfy morta ou indisponível e não pode provocar reinício de containers pelo orquestrador.
