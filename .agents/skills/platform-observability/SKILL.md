---
name: platform-observability
description: Use when implementing, modifying, or reviewing logging, request/job correlation, Zero-PII redaction, lightweight metrics (IMetricsRecorder), operational alerts (OperationalAlertService / Telegram), or health check boundaries in this NestJS backend.
---

# Platform Observability

Siga esta skill sempre que adicionar logs, processadores BullMQ, integrações externas, tratamento de falhas operacionais ou novas features (como `fiscal-notes`) na API ou no Worker.

## Core Rules

1. **Logging estruturado unificado:** use sempre `Logger` do `@nestjs/common` (conectado ao `nestjs-pino`/`pino` via `ObservabilityModule.forApi()` e `ObservabilityModule.forWorker()`). **Nunca** use `console.log`, `console.warn` ou `console.error` em código de produção.
2. **Correlação obrigatória:**
   - Na **API**, o `X-Request-Id` validado (`/^[a-zA-Z0-9._-]+$/`, até `128` chars, fallback UUID v4) é propagado automaticamente via `AsyncLocalStorage` e devolvido no header de resposta.
   - No **Worker**, todo processador BullMQ deve envolver `process(job)` com `runWithJobLogContext({ jobId, queueName, jobName, correlationId? })` (de `api/src/shared/observability/context/observability-context.ts`) para que logs e alertas carreguem o contexto do job.
3. **Política estrita Zero-PII:**
   - **Nunca** logue `req.body` cru, cabeçalhos completos (`authorization`, `cookie`, `set-cookie`), tokens/secrets (`TELEGRAM_BOT_TOKEN`, JWTs, API keys), senhas, CPF/CNPJ, nomes de consumidores ou payloads brutos de terceiros (`rawHtml`).
   - Sempre passe dados estruturados em objetos com chaves conhecidas quando usar o logger para que o `redact` global do Pino atue, e confie em `sanitizeUrl(url)` para mascarar query strings sensíveis (`token`, `code`, `state`, `key`, `hash`, `p`, `password`, `secret`, `cpf`, `cnpj`).
4. **Controle de ruído HTTP:**
   - Não remova a supressão automática de `GET /health/liveness` e `GET /health/readiness` em status `< 400` (`customLogLevel` → `'silent'`), nem altere o mapeamento `2xx/3xx -> info`, `4xx -> warn`, `5xx -> error`.
5. **Métricas desacopladas (`IMetricsRecorder`):**
   - Injete `@Inject(METRICS_RECORDER) private readonly metrics: IMetricsRecorder` em vez de importar `prom-client` ou bibliotecas de métricas diretamente nos módulos de domínio/aplicação.
   - Use apenas `incrementCounter(name, labels?, value?)` e `observeDuration(name, durationMs, labels?)` com `labels` de **baixa cardinalidade** (nunca `userId`, `requestId`, `cpf` ou URLs dinâmicas).
6. **Alertas operacionais (`OperationalAlertService`):**
   - Emita alertas apenas para falhas operacionais acionáveis (`CRITICAL` ou `WARN`) e recuperações (`RESOLVED`) — **nunca** para erros `4xx` de usuário, validação ou regras de negócio (`DomainError` / `ApplicationError`).
   - Use `alertKey` determinística e de **baixa cardinalidade** (ex.: `api:http-500:{METHOD}:{NORMALIZED_ROUTE}` ou `worker:<modulo>:<condicao>`).
   - Mantenha o disparo sempre **fire-and-forget** (`operationalAlertService.notify(...)`); nunca bloqueie fluxos HTTP ou jobs de Worker aguardando resposta do Telegram e nunca vaze `TELEGRAM_BOT_TOKEN` em logs ou exceções.
7. **Fronteiras invioláveis:**
   - **Nunca** coloque alertas operacionais/SRE no módulo `notifications` (`email_messages`/Brevo pertence apenas a usuários finais).
   - **Nunca** adicione checks do Telegram ou de integrações externas não críticas (como SEFAZ) em `/health/liveness` ou `/health/readiness` (`HealthController`).

## Padrões de Uso

### Logging Estruturado e Correlação no Worker

```ts
// Processador BullMQ: encapsular process(job) com contexto de correlação
async process(job: Job<MyPayload>): Promise<void> {
  return runWithJobLogContext(
    {
      jobId: job.id,
      queueName: job.queueName,
      jobName: job.name,
      correlationId: job.data.correlationId,
    },
    async () => {
      this.logger.log({ event: 'MY_JOB_STARTED', entityId: job.data.entityId });
      // Nunca logar CPF, CNPJ, tokens ou HTML bruto em job.data
    },
  );
}
```

### Métricas Leves (`IMetricsRecorder`)

```ts
this.metrics.incrementCounter('fiscal_notes_import_total', { outcome: 'success' });
this.metrics.observeDuration('fiscal_notes_fetch_duration_ms', elapsedMs, { uf: 'CE' });
```

### Alertas Operacionais (`OperationalAlertService`)

```ts
// Apenas falha operacional acionável; injeção @Optional() quando exigido por compatibilidade
this.operationalAlertService?.notify({
  alertKey: 'worker:fiscal-notes:sefaz-ce:parser-broken',
  event: 'FISCAL_NOTE_PARSER_FAILED',
  severity: 'CRITICAL',
  title: 'Falha estrutural no parser SEFAZ-CE',
  summary: 'Mudança inesperada no layout impediu o parsing da nota.',
  metadata: { uf: 'CE', statusCode }, // Zero-PII: nunca incluir chave/CPF/CNPJ/HTML
});
```

### Regras de Ambiente e Cooldown

- `NODE_ENV=test` força `NoopOperationalAlertNotifier` por padrão (nunca dispara HTTP real ao Telegram em testes).
- Fora de `test`, o Telegram só ativa com `TELEGRAM_ALERTS_ENABLED=true` + `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ALERT_CHAT_ID`; na falta de credencial, faz fallback seguro para `NoopOperationalAlertNotifier` com log `warn`.
- Cooldown no Redis usa `obs:alert:cooldown:{alertKey}` (`SET NX EX`) com padrão `900s` (`CRITICAL`) e `1800s` (`WARN`), fallback local em memória se o Redis cair, e limpeza automática ao emitir `RESOLVED`.

## Checklist de Revisão Rápida (Novas Features & PRs)

Antes de aprovar código em qualquer módulo (especialmente integrações externas como `fiscal-notes`):

- [ ] Nenhum `console.log` / `console.error` foi introduzido?
- [ ] Logs de erro/debug estão livres de `req.body`, `headers` crus, tokens, senhas, CPF/CNPJ, nomes pessoais e `rawHtml`?
- [ ] Query strings sensíveis em URLs passam por `sanitizeUrl` ou não são interpoladas manualmente em strings de log?
- [ ] Novos processadores BullMQ envolvem `process(job)` com `runWithJobLogContext(...)`?
- [ ] Métricas usam `IMetricsRecorder` (`METRICS_RECORDER`) com `labels` de baixa cardinalidade?
- [ ] Alertas no Telegram disparam apenas em falhas operacionais (`CRITICAL`/`WARN`) ou recuperações (`RESOLVED`), nunca em erros `4xx`?
- [ ] `alertKey` possui baixa cardinalidade (rota normalizada / chave fixa de módulo) e o envio usa `notify(...)` não-bloqueante?
- [ ] `notifications` e `HealthController` (`/health/liveness`, `/health/readiness`) permaneceram intactos sem acoplamento ao Telegram ou APIs não críticas?

## References

- `docs/platform/observability/README.md` — Visão geral e fronteiras da observabilidade da plataforma.
- `docs/platform/observability/concepts/logging-and-correlation.md` — Pino, JSON/pretty, `X-Request-Id`, `AsyncLocalStorage`, Zero-PII e controle de ruído HTTP.
- `docs/platform/observability/concepts/metrics-and-alerts.md` — `IMetricsRecorder`, `OperationalAlertService`, Telegram Bot API, cooldown Redis e isolamento do `/health`.
- `docs/configuration.md` — Variáveis `LOG_LEVEL`, `TELEGRAM_*` e `ALERT_COOLDOWN_*`.
