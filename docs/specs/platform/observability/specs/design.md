---
area: platform
type: spec-design
status: approved
issue: 143
---

# Design — Fundação Transversal de Observabilidade

## 1. Arquitetura e Camadas Afetadas

A observabilidade é uma capacidade transversal de infraestrutura compartilhada por **API** e **Worker**, seguindo o mesmo padrão modular de `api/src/shared/mail`, `api/src/shared/object-storage` e `api/src/shared/outbox`.

### Estrutura de Diretórios Proposta

```text
api/src/config/
└── observability.config.ts
└── observability.config.spec.ts

api/src/shared/observability/
├── index.ts
├── observability.module.ts
├── constants/
│   └── observability.constants.ts
├── contracts/
│   ├── metrics-recorder.interface.ts
│   └── operational-alert-notifier.interface.ts
├── context/
│   └── observability-context.ts          # Helper de AsyncLocalStorage / correlação API e Worker
├── logging/
│   ├── pino-logger.config.ts             # Fábrica de config pino/pino-http (API e Worker)
│   └── pino-logger.config.spec.ts
├── metrics/
│   ├── structured-log-metrics.recorder.ts
│   └── structured-log-metrics.recorder.spec.ts
└── alerts/
    ├── operational-alert.service.ts
    ├── operational-alert.service.spec.ts
    ├── telegram-operational-alert.notifier.ts
    ├── telegram-operational-alert.notifier.spec.ts
    └── noop-operational-alert.notifier.ts
```

### Integrações Existentes Tocadas

1. `api/package.json`: adicionar `nestjs-pino`, `pino`, `pino-http` em `dependencies` e `pino-pretty` em `devDependencies`.
2. `api/src/config/config.module.ts`: registrar `observabilityConfig` e schema Joi das novas variáveis opcionais.
3. `api/src/common/utils/cache-keys.factory.ts`: adicionar namespace `observability`:
   - `alertCooldown: (alertKey: string) => \`obs:alert:cooldown:${alertKey}\``
   - `metricCounter: (metricName: string, bucket: string) => \`obs:metric:${metricName}:${bucket}\``
4. `api/src/app/api/api.module.ts`: importar `ObservabilityModule.forApi()` (global).
5. `api/src/app/worker/worker.module.ts`: importar `ObservabilityModule.forWorker()` (global).
6. `api/src/main.ts`: passar `{ bufferLogs: true }` no `NestFactory.create(...)`, conectar `app.useLogger(app.get(PinoLogger))` (ou `Logger` do `nestjs-pino`) e expor `X-Request-Id` em `cors.exposedHeaders`.
7. `api/src/worker.ts`: passar `{ bufferLogs: true }` no `NestFactory.createApplicationContext(...)` e conectar `app.useLogger(app.get(Logger))` do `nestjs-pino`.
8. `api/src/common/filters/app-exception.filter.ts`:
   - injetar `@Optional() private readonly operationalAlertService?: OperationalAlertService`;
   - emitir log estruturado `UNHANDLED_HTTP_EXCEPTION` em `INTERNAL_SERVER_ERROR` sem `req.body` cru;
   - disparar `this.operationalAlertService?.notify(...)` (fire-and-forget) com severidade `CRITICAL` e `alertKey` `api:http-500:{METHOD}:{NORMALIZED_ROUTE}`.
9. `api/src/modules/assets/application/services/asset-reconciler.service.ts`:
   - injetar `@Optional() private readonly operationalAlertService?: OperationalAlertService`;
   - manter o log existente `[ASSET_DELETE_QUARANTINED]` (preservando compatibilidade com testes existentes) e disparar alerta `CRITICAL` (`worker:asset-reconciler:quarantine:{assetId}`).
10. Processadores BullMQ existentes (`EmailMessageProcessor`, `TransactionAttachmentOptimizationProcessor`):
    - encapsular a execução de `process(job)` com o helper de contexto do worker (`runWithJobLogContext({ jobId, queueName, jobName })`) para que todos os logs dentro do job carreguem `jobId` e `queueName`.
11. `api/src/modules/health/health.controller.ts`: **NÃO ALTERAR** checks — garantir explicitamente que Telegram / integrações não críticas nunca entram em `/health/liveness` ou `/health/readiness`.

## 2. Configuração e Variáveis de Ambiente (`observability.config.ts`)

| Variável | Tipo | Default | Descrição |
|---|---|---|---|
| `LOG_LEVEL` | `fatal\|error\|warn\|info\|debug\|trace\|silent` | `info` (`silent` ou `error` em `test`) | Nível mínimo de log do Pino |
| `TELEGRAM_ALERTS_ENABLED` | boolean | `false` | Habilita explicitamente envio ao Telegram (desligado em `NODE_ENV=test`) |
| `TELEGRAM_BOT_TOKEN` | string (opcional) | `undefined` | Token do bot no BotFather (nunca logar!) |
| `TELEGRAM_ALERT_CHAT_ID` | string (opcional) | `undefined` | ID do chat/grupo privado de alertas |
| `TELEGRAM_API_BASE_URL` | URI (opcional) | `https://api.telegram.org` | Base URL da API do Telegram (útil para testes/mock) |
| `TELEGRAM_ALERT_TIMEOUT_MS` | number (1000–10000) | `4000` | Timeout rígido por chamada HTTP ao Telegram |
| `ALERT_COOLDOWN_CRITICAL_SECONDS` | number (60–86400) | `900` | Cooldown padrão (15 min) para alertas `CRITICAL` |
| `ALERT_COOLDOWN_WARN_SECONDS` | number (60–86400) | `1800` | Cooldown padrão (30 min) para alertas `WARN` |

### Regras de Ativação do Notifier
- Em `NODE_ENV=test`: sempre resolve para `NoopOperationalAlertNotifier` (a menos que um teste unitário instancie diretamente `TelegramOperationalAlertNotifier` com mock de `fetch`).
- Fora de `test`: ativa `TelegramOperationalAlertNotifier` somente quando `TELEGRAM_ALERTS_ENABLED === true` **e** `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ALERT_CHAT_ID` não estão vazios. Se `TELEGRAM_ALERTS_ENABLED === true` mas faltar token/chatId, faz fallback seguro para `NoopOperationalAlertNotifier` e emite um log `warn` no boot (nunca impede o boot da aplicação).

## 3. Design de Logging (`pino` + `nestjs-pino`)

### 3.1 Campos Base (API e Worker)
Todo log JSON em produção contém:
- `level` (ou label via `formatters.level`), `time` (ISO), `msg`
- `service: 'danfy-backend'`
- `processRole: 'api' | 'worker'`
- `env: NODE_ENV`
- Na API: `requestId` (via `genReqId` + `AsyncLocalStorage` interno do `nestjs-pino`)
- No Worker: `jobId`, `queueName`, `jobName` (via `observabilityContext` `AsyncLocalStorage` lido no `mixin()` do Pino!)

### 3.2 `X-Request-Id`
- Função `resolveRequestId(req, res)`:
  - Lê `req.headers['x-request-id']`;
  - Aceita apenas se for string não vazia com `<= 128` caracteres correspondendo a `/^[a-zA-Z0-9._-]+$/`;
  - Caso contrário, gera `randomUUID()` (`node:crypto`);
  - Seta `res.setHeader('X-Request-Id', requestId)` e retorna `requestId`.
- Em `main.ts`, incluir `'X-Request-Id'` em `exposedHeaders` do CORS (junto com `'Retry-After'`).

### 3.3 Redaction Global e Sanitização (Zero-PII)
Configurar `redact` no Pino com `censor: '[REDACTED]'`:
- `req.headers.authorization`
- `req.headers.cookie`
- `res.headers['set-cookie']`
- `*.password`, `*.currentPassword`, `*.newPassword`, `*.confirmPassword`
- `*.token`, `*.accessToken`, `*.refreshToken`, `*.secret`, `*.apiKey`, `*.botToken`
- `*.cpf`, `*.cnpj`, `*.consumerDocument`, `*.consumerName`, `*.rawHtml`

Serializers customizados em `pino-http`:
- `req(req)`: retornar **apenas** `{ id, method, url: sanitizeUrl(req.url), remoteAddress }` — **nunca** `headers` completos nem `body`.
- `res(res)`: retornar **apenas** `{ statusCode }`.
- `sanitizeUrl(url)`: preserva pathname e mascara valores de query params sensíveis (`token`, `access_token`, `refresh_token`, `code`, `state`, `password`, `key`, `hash`, `p`, `secret`, `api_key`, `cpf`, `cnpj`) como `[REDACTED]`.

### 3.4 Controle de Ruído HTTP
- `autoLogging`:
  - `ignore: (req) => false` (não ignorar antes da resposta, porque falhas em `/health` DEVEM ser logadas!).
  - Usar `customLogLevel(req, res, err)`:
    - Se `(req.url?.startsWith('/health') && res.statusCode < 400 && !err)` → retornar `'silent'` (suprime `/health/liveness` e `/health/readiness` quando `200`, mas loga se falhar `>= 400` ou erro!).
    - Se `res.statusCode >= 500 || err` → `'error'`.
    - Se `res.statusCode >= 400` → `'warn'`.
    - Caso contrário → `'info'`.

## 4. Design de Métricas Leves (`IMetricsRecorder`)

### Contrato (`metrics-recorder.interface.ts`)
```ts
export const METRICS_RECORDER = Symbol('METRICS_RECORDER');

export type MetricLabels = Record<string, string | number | boolean>;

export interface IMetricsRecorder {
  incrementCounter(name: string, labels?: MetricLabels, value?: number): void;
  observeDuration(name: string, durationMs: number, labels?: MetricLabels): void;
}
```
- Implementação V1 (`StructuredLogMetricsRecorder`):
  - Não lança exceções (protegido por `try/catch`);
  - Emite log estruturado de nível `info` (ou `debug` conforme config) com `{ event: 'METRIC_RECORDED', metricType: 'counter' | 'histogram', metricName, value, labels }` usando o logger da plataforma;
  - Mantém contrato limpo e 100% compatível com futura implementação `PrometheusMetricsRecorder` (`prom-client`) no Nível 2.

## 5. Design de Alertas Operacionais (`OperationalAlertService` + Telegram)

### Contratos (`operational-alert-notifier.interface.ts`)
```ts
export const OPERATIONAL_ALERT_NOTIFIER = Symbol('OPERATIONAL_ALERT_NOTIFIER');

export type OperationalAlertSeverity = 'CRITICAL' | 'WARN' | 'RESOLVED';

export interface OperationalAlertInput {
  alertKey: string;
  event: string;
  severity: OperationalAlertSeverity;
  title: string;
  summary: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  cooldownSeconds?: number;
  requestId?: string;
  jobId?: string;
}

export interface FormattedOperationalAlert extends OperationalAlertInput {
  environment: string;
  processRole: string;
  timestamp: string;
}

export interface IOperationalAlertNotifier {
  send(alert: FormattedOperationalAlert): Promise<void>;
}
```

### Fluxo do `OperationalAlertService.notify(input)`
1. Enriquecer o alerta com `environment` (`PROD` | `STAGING` | `DEV` | `TEST`), `processRole`, `timestamp: new Date().toISOString()`, e preencher automaticamente `requestId` / `jobId` do `AsyncLocalStorage` se não informados explicitamente.
2. **Fire-and-forget seguro:** `notify(...)` dispara a rotina assíncrona (`void this.dispatch(alert)`) e retorna `void` imediatamente (ou `notifyAsync` para testes determinísticos), garantindo que nenhum caller espere pela rede do Telegram nem receba exceção rejeitada.
3. **Cooldown no Redis (`CacheKeys.observability.alertCooldown(alert.alertKey)`):**
   - Se `severity === 'RESOLVED'`: chama `redis.del(cooldownKey)` (em `try/catch`) e prossegue para o envio;
   - Se `severity === 'CRITICAL' | 'WARN'`: calcula TTL (`input.cooldownSeconds ?? defaultBySeverity`) e chama `redis.getClient().set(cooldownKey, '1', 'EX', ttl, 'NX')`:
     - Se retornar `null` (já em cooldown): loga `{ event: 'OPERATIONAL_ALERT_SUPPRESSED', alertKey, severity }` e encerra sem chamar o Telegram;
     - Se Redis falhar: loga `warn` (`OPERATIONAL_ALERT_COOLDOWN_REDIS_ERROR`) e, para evitar flood durante queda do Redis, aplica fallback de deduplicação em memória (`Map<string, number>` local com TTL) antes de enviar.
4. Chama `await this.notifier.send(alert)` dentro de `try/catch`; se falhar, loga `warn` (`OPERATIONAL_ALERT_DELIVERY_FAILED`) sem propagar erro.

### `TelegramOperationalAlertNotifier`
- Monta texto plano formatado e limpo (sem Markdown frágil que quebra com `_` ou `*` em rotas/códigos, ou escapando HTML corretamente com `parse_mode: 'HTML'`):
  ```text
  🚨 [PROD] [CRITICAL] API — UNHANDLED_HTTP_EXCEPTION
  Erro inesperado 500 na rota POST /transactions
  • alertKey: api:http-500:POST:/transactions
  • requestId: 550e8400-e293-41d4-a716-446655440000
  • processRole: api
  • time: 2026-11-26T15:00:00.000Z
  ```
- Faz `fetch(`${baseUrl}/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }), signal: AbortSignal.timeout(timeoutMs) })`.
- Se `!response.ok`, lança erro interno contendo apenas `status` HTTP (nunca logar `botToken` na URL nem na mensagem de erro!).

## 6. Integrações de Alerta da V1

### 6.1 `AppExceptionFilter`
- Apenas quando `errorResponse.statusCode === 500 && errorResponse.code === 'INTERNAL_SERVER_ERROR'`:
  - Normaliza rota: usa `request.route?.path` (com `request.baseUrl`) quando disponível; caso contrário, extrai apenas o pathname de `request.originalUrl ?? request.url` sem query string e truncado a 120 chars.
  - Emite log estruturado `error` com `{ event: 'UNHANDLED_HTTP_EXCEPTION', method, route, statusCode: 500, errorCode: 'INTERNAL_SERVER_ERROR', requestId, err }` (sem `req.body`).
  - Dispara `this.operationalAlertService?.notify({ alertKey: \`api:http-500:${request.method}:${normalizedRoute}\`, event: 'UNHANDLED_HTTP_EXCEPTION', severity: 'CRITICAL', title: 'Erro interno inesperado na API (500)', summary: \`${request.method} ${normalizedRoute} falhou com erro inesperado.\`, metadata: { method: request.method, route: normalizedRoute, statusCode: 500 } })`.

### 6.2 `AssetReconcilerService`
- No bloco `if (quarantined)`:
  - Mantém o `this.logger.error(...)` com `[ASSET_DELETE_QUARANTINED]` (compatibilidade com testes existentes).
  - Dispara `this.operationalAlertService?.notify({ alertKey: \`worker:asset-reconciler:quarantine:${asset.id}\`, event: 'ASSET_DELETE_QUARANTINED', severity: 'CRITICAL', title: 'Asset enviado para quarentena no reconciliador', summary: \`Asset ${asset.id} atingiu ${attempts} falhas consecutivas de exclusão física no storage.\`, metadata: { assetId: asset.id, attempts } })`.

## 7. Impacto em Banco de Dados e Migrations

- **Nenhuma alteração de schema PostgreSQL.** Nenhuma migration necessária. `docs/database/schema.md` não é afetado.

## 8. Estratégia de Testes

1. **Testes Unitários (Jest):**
   - `observability.config.spec.ts`: defaults, validação Joi, ativação/fallback do Telegram por ambiente.
   - `pino-logger.config.spec.ts`: `resolveRequestId` (válido, inválido/injeção, ausente), `sanitizeUrl` (mascara `token`/`p`/`hash`), `customLogLevel` (`/health/*` `200` → `'silent'`, `/health/*` `503` → `'error'`, `2xx` → `'info'`, `4xx` → `'warn'`, `5xx` → `'error'`), `redact` de campos sensíveis.
   - `structured-log-metrics.recorder.spec.ts`: counter, duration e resiliência a erro.
   - `operational-alert.service.spec.ts`: cooldown Redis (`SET NX EX`), supressão em duplicata, limpeza de cooldown em `RESOLVED`, fallback em memória quando Redis cai, isolamento de erro do notifier, enriquecimento automático de `requestId`/`jobId`.
   - `telegram-operational-alert.notifier.spec.ts`: chamada correta à Bot API (mock de `fetch`), timeout via `AbortSignal.timeout`, erro HTTP `>= 400` sem vazar `botToken`, formatação com prefixo de ambiente e sem PII.
   - `app-exception.filter.spec.ts`: verificar disparo de alerta `CRITICAL` em erro `500` inesperado, ausência de alerta em erros `4xx`, e compatibilidade de `new AppExceptionFilter()`.
   - `asset-reconciler.service.spec.ts`: verificar disparo de alerta `CRITICAL` quando `quarantined === true`.
2. **Testes de Integração / E2E:**
   - Teste de integração Redis validando cooldown real (`SET NX EX` + `RESOLVED`) com container Redis (seguindo padrão de `api/test/*-redis.integration-spec.ts` e `test-suite-governance`).
   - Teste E2E validando header `X-Request-Id` (gerado e propagado), sanitização de `X-Request-Id` inválido, e comportamento intacto de `/health/liveness`.
3. **Verificação ao vivo (Supervisor):**
   - Subir API local + Redis + Postgres, testar requests reais via `curl` (`X-Request-Id`, `/health/liveness` silencioso em `200`, log JSON em modo produção simulado, validação de erro `4xx` sem alerta e comportamento do Worker).

## 9. Impacto em Documentação e Governança

- Criar `docs/platform/observability/`:
  - `README.md` (mapa do contexto de observabilidade)
  - `concepts/logging-and-correlation.md` (Pino, JSON, `requestId`/`jobId`, Zero-PII/redaction, ruído HTTP)
  - `concepts/metrics-and-alerts.md` (`IMetricsRecorder`, `OperationalAlertService`, Telegram Bot API, cooldown, catálogo de `alertKey`s e regra de isolamento do `/health`)
- Atualizar `docs/platform/README.md`, `docs/specs/README.md`, `docs/configuration.md` e `.env.exemple`.
- Criar skill `.agents/skills/platform-observability/SKILL.md` (no mesmo padrão de `.agents/skills/platform-errors/SKILL.md`).
