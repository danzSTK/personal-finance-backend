---
area: platform
type: spec-requirements
status: approved
issue: 143
---

# Requirements — Fundação Transversal de Observabilidade

## 1. Objetivo

Implantar a fundação transversal de observabilidade **Nível 1** (sem adicionar containers de infraestrutura pesada na VPS) para os processos **API** (`PROCESS_ROLE=api`) e **Worker** (`PROCESS_ROLE=worker`) da Danfy, entregando:

- logging estruturado em JSON via `pino` / `nestjs-pino` com correlação ponta a ponta (`requestId`, `jobId`, `processRole`);
- política estrita de redaction e Zero-PII nos logs;
- controle de ruído HTTP (supressão de `/health` `200` e níveis por status HTTP);
- porta desacoplada de métricas leves (`IMetricsRecorder`) preparada para evolução futura (Prometheus / OpenTelemetry);
- serviço transversal de alertas operacionais ativos via **Telegram Bot API** (separado do módulo `notifications` de produto) com deduplicação/cooldown no Redis e falha totalmente isolada;
- integração inicial dos alertas transversais da plataforma (erro `500` inesperado na API e quarentena de asset no `AssetReconcilerService`);
- documentação viva em `docs/platform/observability/` e skill de governança `.agents/skills/platform-observability/SKILL.md`.

## 2. Contexto e Documentos de Origem

- GitHub Issue: `#143` — `[PLATFORM] Implantar fundação transversal de observabilidade (logs estruturados, métricas leves e alertas no Telegram)`
- Especificação de análise no Notion: `Observabilidade — logs estruturados, métricas e alertas operacionais`
- Pré-requisito direto de: Issue `#144` (`[FISCAL-NOTES] Permitir leitura e importação de NFC-e (SEFAZ-CE)`)
- Referências no repositório:
  - `api/src/main.ts` e `api/src/worker.ts`
  - `api/src/common/filters/app-exception.filter.ts`
  - `api/src/modules/assets/application/services/asset-reconciler.service.ts`
  - `api/src/modules/health/health.controller.ts`
  - `api/src/common/utils/cache-keys.factory.ts`

## 3. Escopo (In Scope)

1. Engine de logging estruturado (`pino` + `nestjs-pino`) unificada para API e Worker, mantendo compatibilidade com `new Logger(...)` do NestJS.
2. Propagação automática de `requestId` (UUID, header `X-Request-Id`) via `AsyncLocalStorage` na API, `jobId`/`queueName` nos processadores BullMQ do Worker e `processRole` (`api` | `worker`) em ambos.
3. Redaction global de dados sensíveis e proibição de logar PII/HTML bruto/`req.body` cru.
4. Controle de ruído HTTP (`GET /health/*` com status `200` suprimido; níveis `info`/`warn`/`error` por status; query strings sensíveis sanitizadas).
5. Porta `IMetricsRecorder` (`incrementCounter`, `observeDuration`) com implementação V1 leve baseada em logs estruturados e suporte a contadores opcionais no Redis.
6. Módulo transversal `ObservabilityModule` (separado de `notifications`) com `OperationalAlertService`, `IOperationalAlertNotifier`, `TelegramOperationalAlertNotifier` e `NoopOperationalAlertNotifier`.
7. Deduplicação/cooldown no Redis por `alertKey` (`CRITICAL`: 15 min + suporte a `RESOLVED`; `WARN`: 30–60 min).
8. Integração inicial de 2 alertas transversais:
   - `CRITICAL` em erro `500` inesperado no `AppExceptionFilter` (cooldown por rota);
   - `CRITICAL` na quarentena de asset no `AssetReconcilerService`.
9. Documentação viva em `docs/platform/observability/`, atualização de `.env.exemple`, `docs/configuration.md`, `docs/platform/README.md` e criação da skill `.agents/skills/platform-observability/SKILL.md`.
10. Testes unitários, de integração e E2E cobrindo todas as garantias acima.

## 4. Fora de Escopo (Out of Scope)

- Subir novos containers de observabilidade na VPS (Grafana, Loki, Prometheus, Alertmanager).
- Instalar `prom-client` ou expor endpoint `/metrics` na V1.
- Tracing distribuído completo (OpenTelemetry / Jaeger / Tempo).
- Alertas do módulo `fiscal-notes` (serão plugados na Issue `#144` consumindo a fundação entregue aqui).
- Alterações no módulo `notifications` (e-mails transacionais de produto via Brevo).
- Alterações de schema no PostgreSQL.

## 5. Requisitos Funcionais e Não Funcionais

### RF-01 — Logging Estruturado (API e Worker)
- **WHEN** `NODE_ENV=production`, **THE SYSTEM SHALL** emitir logs em JSON estruturado (uma linha por evento) para `stdout` tanto na API quanto no Worker.
- **WHEN** `NODE_ENV=development`, **THE SYSTEM SHALL** formatar logs de forma legível para desenvolvimento local (via `pino-pretty`) sem exigir mudança no código dos módulos.
- **THE SYSTEM SHALL** manter compatibilidade com chamadas existentes a `new Logger(Context)` do `@nestjs/common` em ambos os processos.

### RF-02 — Correlação Ponta a Ponta
- **WHEN** a API recebe uma requisição HTTP, **THE SYSTEM SHALL** extrair um `X-Request-Id` válido (se fornecido e sanitizado, até 128 chars alfanuméricos/`-`/`_`/`.`) ou gerar um UUID v4, propagá-lo automaticamente via `AsyncLocalStorage` em todos os logs da requisição e devolvê-lo no header de resposta `X-Request-Id`.
- **THE SYSTEM SHALL** incluir `processRole` (`'api'` ou `'worker'`) em todos os logs emitidos.
- **WHEN** um processador BullMQ executa um job no Worker, **THE SYSTEM SHALL** vincular `jobId`, `queueName` e `jobName` (e `correlationId` se presente no payload) ao contexto de log daquele job.

### RF-03 — Redaction e Política Zero-PII
- **THE SYSTEM SHALL** aplicar `redact` global em campos e cabeçalhos sensíveis (`authorization`, `cookie`, `set-cookie`, `password`, `currentPassword`, `newPassword`, `token`, `accessToken`, `refreshToken`, `secret`, `apiKey`, `cpf`, `cnpj`, `rawHtml`, etc.).
- **THE SYSTEM SHALL NEVER** despejar `req.body` cru ou headers completos nos logs automáticos HTTP ou no tratamento de erros `500`.
- **WHEN** uma URL possuir query parameters sensíveis (ex.: `token`, `code`, `state`, `key`, `hash`, `p`, `password`), **THE SYSTEM SHALL** mascarar seus valores antes de registrar a URL no log HTTP.

### RF-04 — Controle de Ruído HTTP
- **WHEN** uma requisição para `/health/liveness` ou `/health/readiness` retornar status `200`, **THE SYSTEM SHALL** suprimir o log automático de acesso HTTP.
- **WHEN** uma requisição para `/health/*` retornar status `>= 400`, **THE SYSTEM SHALL** registrar o log normalmente.
- **THE SYSTEM SHALL** classificar o nível do log HTTP por status: `2xx/3xx` → `info`, `4xx` → `warn`, `5xx` → `error`.

### RF-05 — Porta de Métricas Leves (`IMetricsRecorder`)
- **THE SYSTEM SHALL** disponibilizar a porta `IMetricsRecorder` para injeção global em módulos da API e do Worker, oferecendo ao menos `incrementCounter(name, labels?, value?)` e `observeDuration(name, durationMs, labels?)`.
- **THE SYSTEM SHALL** implementar na V1 um recorder leve baseado em logs estruturados (`event: 'METRIC_RECORDED'`) que não depende de servidor Prometheus e não lança exceções para os chamadores.

### RF-06 — Alertas Operacionais no Telegram com Cooldown e Isolamento
- **THE SYSTEM SHALL** fornecer um serviço transversal `OperationalAlertService` desacoplado de `notifications`, suportando severidades `CRITICAL`, `WARN` e `RESOLVED`.
- **WHEN** um alerta com `alertKey` for disparado com severidade `CRITICAL` ou `WARN`, **THE SYSTEM SHALL** tentar adquirir cooldown no Redis via `SET obs:alert:cooldown:{alertKey} 1 EX <ttlSeconds> NX`:
  - `CRITICAL`: cooldown padrão de `900s` (15 min), configurável por env/parâmetro;
  - `WARN`: cooldown padrão de `1800s` (30 min), configurável por env/parâmetro.
- **IF** a chave de cooldown já existir no Redis, **THEN** o envio ao Telegram deve ser suprimido e registrado apenas em log estruturado (`event: 'OPERATIONAL_ALERT_SUPPRESSED'`).
- **WHEN** um alerta `RESOLVED` for disparado, **THE SYSTEM SHALL** limpar a chave de cooldown da respectiva `alertKey` (se houver) e enviar a notificação de recuperação sem ser bloqueado pelo cooldown anterior.
- **IF** o Redis estiver temporariamente indisponível ao checar cooldown, **THEN** o sistema não deve lançar exceção para o chamador (falha segura/isolada).
- **THE SYSTEM SHALL** executar toda chamada à Telegram Bot API em modo não-bloqueante (`fire-and-forget` com tratamento interno de erros) e com timeout rígido configurável (padrão `4000ms`, faixa `1000–10000ms`).
- **IF** o Telegram falhar, retornar HTTP `>= 400` ou expirar o timeout, **THEN** a requisição HTTP ou o job do Worker **NUNCA** pode falhar nem sofrer atraso perceptível; apenas um log `warn` local deve ser emitido.
- **THE SYSTEM SHALL** incluir em toda mensagem enviada ao Telegram: prefixo de ambiente (`[PROD]`, `[STAGING]`, `[DEV]`, `[TEST]`), severidade, `processRole`, `event`/`alertKey`, resumo legível, `requestId`/`jobId` (quando disponível) e timestamp ISO — **sem PII**.

### RF-07 — Controle por Variáveis de Ambiente
- **WHEN** `NODE_ENV=test`, **THE SYSTEM SHALL** utilizar `NoopOperationalAlertNotifier` por padrão (nunca disparar chamadas HTTP reais ao Telegram durante testes automatizados).
- **WHEN** `TELEGRAM_ALERTS_ENABLED=true` e `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ALERT_CHAT_ID` estiverem preenchidos (fora de `test`), **THE SYSTEM SHALL** ativar `TelegramOperationalAlertNotifier`.
- **WHEN** `TELEGRAM_ALERTS_ENABLED=false` ou qualquer credencial estiver ausente, **THE SYSTEM SHALL** operar de forma segura com `NoopOperationalAlertNotifier` sem impedir o boot da aplicação.

### RF-08 — Alertas Transversais Iniciais da Plataforma
- **WHEN** o `AppExceptionFilter` capturar um erro inesperado mapeado como `INTERNAL_SERVER_ERROR` (`statusCode === 500` e `code === 'INTERNAL_SERVER_ERROR'`), **THE SYSTEM SHALL**:
  1. registrar log estruturado com `event: 'UNHANDLED_HTTP_EXCEPTION'`, `route`, `method`, `statusCode`, `errorCode`, `requestId`, `err` (sem `req.body` cru);
  2. disparar alerta `CRITICAL` com `alertKey` baseada em método + rota normalizada (`api:http-500:{method}:{route}`), respeitando o cooldown de 15 min.
- **WHEN** o `AssetReconcilerService` colocar um asset em quarentena (`quarantined === true`), **THE SYSTEM SHALL** disparar alerta `CRITICAL` com `alertKey` `worker:asset-reconciler:quarantine:{assetId}` (ou agrupado por asset), mantendo intacto o comportamento atual de persistência e log `[ASSET_DELETE_QUARANTINED]`.

### RF-09 — Isolamento Total de `/health`
- **THE SYSTEM SHALL NEVER** adicionar checks de Telegram ou de integrações externas não críticas nos endpoints `/health/liveness` ou `/health/readiness`.

### RF-10 — Documentação Viva e Skill de Governança
- **THE SYSTEM SHALL** possuir documentação modular em `docs/platform/observability/` (indexada em `docs/platform/README.md`) e documentação de env vars em `.env.exemple` e `docs/configuration.md`.
- **THE SYSTEM SHALL** possuir a skill `.agents/skills/platform-observability/SKILL.md` governando logs estruturados, correlação, Zero-PII, métricas, alertas no Telegram e isolamento do `/health`.

## 6. Casos de Borda (Edge Cases)

- `X-Request-Id` enviado pelo cliente com caracteres maliciosos (newlines/injeção de log) ou > 128 chars → ignorar o valor do cliente e gerar novo UUID v4.
- `AppExceptionFilter` instanciado diretamente em testes unitários antigos (`new AppExceptionFilter()`) → dependência de `OperationalAlertService` deve ser `@Optional()` para não quebrar retrocompatibilidade.
- `AssetReconcilerService` instanciado em testes unitários antigos → dependência de `OperationalAlertService` deve ser `@Optional()` (com testes novos cobrindo a chamada quando presente).
- Erro no Redis durante o envio do alerta → nunca propagar erro ao fluxo principal; fazer fallback seguro (log `warn` e evitar flood).
- Exceção não-`Error` (string/objeto lançado com `throw`) no `AppExceptionFilter` → serializar com segurança sem quebrar o logger ou o alerta.
- Rota com parâmetros dinâmicos ou 404/sem `req.route` no `AppExceptionFilter` → normalizar rota (`req.route?.path` quando disponível, senão pathname sanitizado sem query string) para evitar explosão de `alertKey`s no Redis.

## 7. Critérios de Aceitação

- [ ] API e Worker sobem normalmente com `nestjs-pino` e emitem JSON válido em `NODE_ENV=production`.
- [ ] Toda resposta HTTP retorna header `X-Request-Id` e o mesmo ID aparece nos logs da requisição.
- [ ] `GET /health/liveness` e `GET /health/readiness` com status `200` não geram log de acesso HTTP.
- [ ] Testes automatizados confirmam redaction de `Authorization`, `Cookie`, senhas, tokens e query params sensíveis.
- [ ] `IMetricsRecorder` funciona em API e Worker sem lançar erros.
- [ ] `OperationalAlertService` respeita cooldown no Redis (`SET NX EX`), libera em `RESOLVED`, isola falhas/timeout do Telegram e permanece no-op em `NODE_ENV=test`.
- [ ] Erro `500` inesperado dispara log estruturado + alerta `CRITICAL` sem expor PII/body.
- [ ] Quarentena em `AssetReconcilerService` dispara alerta `CRITICAL` preservando o comportamento existente.
- [ ] `docs/platform/observability/`, `.env.exemple`, `docs/configuration.md`, `docs/platform/README.md` e `.agents/skills/platform-observability/SKILL.md` estão completos e coerentes com a implementação.
- [ ] `lint:check`, `typecheck`, `test`, `test:integration` e `test:e2e` passam integralmente.
