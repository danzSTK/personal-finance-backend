---
area: platform
type: concept
status: current
last_reviewed: 2026-11-26
related:
  - ../README.md
  - ./metrics-and-alerts.md
  - ../../workers/README.md
  - ../../../configuration.md
  - ../../../security/README.md
---

# Logging Estruturado, Correlação e Política Zero-PII

A Danfy utiliza uma engine unificada de logging baseada em **`pino`** e **`nestjs-pino`** para ambos os processos do backend (`PROCESS_ROLE=api` e `PROCESS_ROLE=worker`), configurada em `api/src/shared/observability/logging/pino-logger.config.ts` e exposta pelos modos `ObservabilityModule.forApi()` e `ObservabilityModule.forWorker()`.

O objetivo é garantir rastreabilidade ponta a ponta com baixo overhead no Event Loop, compatibilidade integral com `new Logger(Context)` do `@nestjs/common` e proteção estrita contra vazamento de dados pessoais (PII) ou segredos.

## Arquitetura Unificada (API e Worker)

Ambos os entrypoints conectam o logger da plataforma com `{ bufferLogs: true }` para capturar inclusive os logs iniciais de bootstrap antes da injeção completa do container:

- **API (`api/src/main.ts`):** `NestFactory.create(ApiModule, { bufferLogs: true })` + `app.useLogger(...)` com `ObservabilityModule.forApi()` registrado globalmente em `ApiModule`.
- **Worker (`api/src/worker.ts`):** `NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true })` + `app.useLogger(...)` com `ObservabilityModule.forWorker()` registrado globalmente em `WorkerModule`.
- **Compatibilidade:** módulos de domínio, aplicação e infraestrutura continuam usando `new Logger(Context)` do `@nestjs/common`, que passa a delegar automaticamente para a instância configurada do `pino`.

### Campos Base em Produção

Todo evento de log emitido em produção contém:

- `level` (via `formatters.level`), `time` (ISO 8601) e `msg`;
- `service: 'danfy-backend'`;
- `processRole`: `'api'` ou `'worker'`;
- `env`: valor de `NODE_ENV`;
- **Na API:** `requestId` propagado via `AsyncLocalStorage` interno do `nestjs-pino`;
- **No Worker:** `jobId`, `queueName`, `jobName` (e `correlationId` quando presente no payload), propagados via `observability-context.ts`.

### Produção (JSON) vs Desenvolvimento (`pino-pretty`)

| Ambiente | Formato | Destino | Controle |
| --- | --- | --- | --- |
| `NODE_ENV=production` | JSON estruturado (uma linha por evento) | `stdout` | `LOG_LEVEL` (padrão `info`) |
| `NODE_ENV=development` | Saída legível formatada via `pino-pretty` (`devDependencies`) | `stdout` | `LOG_LEVEL` (padrão `info`) |
| `NODE_ENV=test` | JSON/estruturado suprimido por padrão | `stdout` | `LOG_LEVEL` (`silent` por padrão em `test`) |

## Correlação Ponta a Ponta

### Contrato HTTP (`X-Request-Id`)

A função `resolveRequestId(req, res)` garante um identificador de correlação seguro e previsível em toda requisição HTTP:

1. Lê `req.headers['x-request-id']`.
2. Aceita o valor enviado pelo cliente **somente** se for uma string não vazia com no máximo `128` caracteres correspondendo à expressão regular `/^[a-zA-Z0-9._-]+$/`.
3. Se o cabeçalho estiver ausente, vazio, exceder `128` caracteres ou contiver caracteres fora do padrão (como quebras de linha ou tentativas de log injection), descarta o valor e gera um novo UUID v4 via `randomUUID()` (`node:crypto`).
4. Define o cabeçalho de resposta `X-Request-Id` com o identificador efetivo e o propaga automaticamente via `AsyncLocalStorage` para todos os logs gerados durante o ciclo da requisição.

Em `api/src/main.ts`, `'X-Request-Id'` deve permanecer listado em `cors.exposedHeaders` (junto com `'Retry-After'`) para que clientes web possam ler o identificador de rastreio nas respostas.

### Contexto Assíncrono no Worker (`AsyncLocalStorage`)

Em `api/src/shared/observability/context/observability-context.ts`, o contexto de execução do Worker usa `AsyncLocalStorage`, lido pelo `mixin()` do Pino em cada emissão de log.

Processadores BullMQ (como `EmailMessageProcessor`, `TransactionAttachmentOptimizationProcessor` e novos processadores) devem encapsular a execução de `process(job)` com `runWithJobLogContext({ jobId, queueName, jobName, correlationId? })`. Dessa forma, qualquer log emitido por serviços internos ou alertas operacionais disparados durante o processamento carrega automaticamente `jobId`, `queueName` e `jobName` sem precisar repassar parâmetros manualmente por todas as camadas.

## Política Estrita Zero-PII

Logs estruturados são infraestrutura compartilhada e **nunca** podem armazenar dados pessoais sensíveis, credenciais ou payloads brutos de terceiros.

### Redaction Global

O Pino é configurado com `redact` global usando `censor: '[REDACTED]'` para os seguintes caminhos:

- **Cabeçalhos HTTP:** `req.headers.authorization`, `req.headers.cookie`, `res.headers['set-cookie']`
- **Credenciais e tokens:** `*.password`, `*.currentPassword`, `*.newPassword`, `*.confirmPassword`, `*.token`, `*.accessToken`, `*.refreshToken`, `*.secret`, `*.apiKey`, `*.botToken`
- **Dados pessoais e fiscais brutos:** `*.cpf`, `*.cnpj`, `*.consumerDocument`, `*.consumerName`, `*.rawHtml`

### Serializers HTTP e `sanitizeUrl`

Para impedir vazamento acidental em logs automáticos de acesso ou erro:

- **`req(req)`:** serializa exclusivamente `{ id, method, url: sanitizeUrl(req.url), remoteAddress }` — **nunca** inclui `req.headers` completos nem `req.body`.
- **`res(res)`:** serializa exclusivamente `{ statusCode }`.
- **`sanitizeUrl(url)`:** preserva o pathname e mascara com `[REDACTED]` os valores de parâmetros de query sensíveis (`token`, `access_token`, `refresh_token`, `code`, `state`, `password`, `key`, `hash`, `p`, `secret`, `api_key`, `cpf`, `cnpj`).

### Proibições Absolutas nos Módulos

- **Nunca** usar `console.log`, `console.warn` ou `console.error` em código de aplicação/domínio/infraestrutura.
- **Nunca** logar `req.body` cru ou cabeçalhos completos — inclusive no `AppExceptionFilter` ao registrar `UNHANDLED_HTTP_EXCEPTION`.
- **Nunca** logar CPF, CNPJ, nomes de consumidores, e-mails pessoais desnecessários, tokens JWT, chaves de API, `TELEGRAM_BOT_TOKEN` ou HTML bruto retornado por terceiros (ex.: páginas de notas fiscais da SEFAZ).

## Controle de Ruído HTTP

Para evitar que probes frequentes de orquestração saturem o `stdout` sem ocultar falhas reais:

- `autoLogging.ignore` retorna `false` para todas as rotas, garantindo que a decisão de log ocorra **após** conhecer o status HTTP da resposta.
- `customLogLevel(req, res, err)` classifica cada requisição conforme a regra abaixo:

| Condição | Nível de Log | Motivo |
| --- | --- | --- |
| `req.url?.startsWith('/health') && res.statusCode < 400 && !err` | `silent` | Suprime ruído de `/health/liveness` e `/health/readiness` saudáveis (`200`) |
| `res.statusCode >= 500 \|\| Boolean(err)` | `error` | Destaca falhas internas e falhas de `/health/*` (`503`, etc.) |
| `res.statusCode >= 400` | `warn` | Registra erros de cliente/validação/autorização sem falso alarme crítico |
| Demais respostas (`2xx` / `3xx`) | `info` | Registra tráfego normal da API com `requestId` e `statusCode` |
