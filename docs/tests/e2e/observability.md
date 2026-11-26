# `observability.e2e-spec.ts`

## Classificação e objetivo

- Arquivo: `api/test/observability.e2e-spec.ts`
- Categoria: E2E HTTP isolado.
- Objetivo: validar a integração HTTP de `ObservabilityModule.forApi()` com `Logger` (`nestjs-pino`), `HealthController`, `AppExceptionFilter`, propagação de `X-Request-Id` via `AsyncLocalStorage` e disparo seletivo de alertas em erro `500`.
- Fora de escopo: envio real ao Telegram Bot API, PostgreSQL, Redis, BullMQ e processo Worker.

## Comportamentos comprovados

- `GET /health/liveness` responde `200` sem dependências do Telegram, registra `OPERATIONAL_ALERT_NOTIFIER`, retorna `X-Request-Id` em UUID v4 e não dispara alerta;
- `X-Request-Id` válido enviado pelo cliente (`frontend-trace_2026.01`) é ecoado no header de resposta e propagado em `getObservabilityContext()?.requestId`;
- `X-Request-Id` inválido ou fora do padrão (`invalid space value!`) é descartado e substituído por um novo UUID v4 tanto no header de resposta quanto no contexto;
- erros `4xx` (`BadRequestException` retornando `400`) não disparam `OperationalAlertService.notify`;
- erro `500` inesperado em rota parametrizada (`/observability-test/items/:id/boom`) retorna `X-Request-Id` e dispara `OperationalAlertService.notify` com severidade `CRITICAL`, `event: 'UNHANDLED_HTTP_EXCEPTION'`, `requestId` e `alertKey` normalizada (`api:http-500:GET:/observability-test/items/:id/boom`).

## Composição

- Componentes reais: aplicação NestJS com `ObservabilityModule.forApi()`, `Logger` (`nestjs-pino`), `HealthController`, controlador de teste `ObservabilityTestController`, `AppExceptionFilter`, `OperationalAlertService`, `NoopOperationalAlertNotifier` (`NODE_ENV=test`) e Supertest.
- Componentes mockados: `HealthCheckService`, `TypeOrmHealthIndicator`, `MemoryHealthIndicator` e `RedisHealthIndicator`; `jest.spyOn(operationalAlertService, 'notify')` observa os disparos de alerta.

## Dependências de execução

| Dependência | Versão | Provisionamento | Obrigatória |
| ----------- | ------ | --------------- | ----------- |
| Nenhuma     | —      | processo Jest   | —           |

- Docker: não utiliza.
- Rede externa: nenhuma.
- Credenciais reais: nenhuma (`NODE_ENV=test` força `NoopOperationalAlertNotifier` e `LOG_LEVEL=silent`).
- Portas: nenhuma porta fixa; usa servidor HTTP efêmero via Supertest.

## Isolamento e cleanup

Força `NODE_ENV=test`, `PROCESS_ROLE=api` e `LOG_LEVEL=silent` em `beforeAll`, restaura `process.env` e encerra `app.close()` em `afterAll`, e limpa mocks com `jest.clearAllMocks()` em `beforeEach`.

## Execução

```bash
# Diagnóstico direcionado
npm run test:e2e -- observability.e2e-spec.ts

# Validação agregada obrigatória
npm run test:e2e
```

- Job de CI: `Unit and E2E tests`.
- Falhas de ambiente conhecidas: nenhuma dependência externa além de Node.js/Jest.

## Quando atualizar

Atualizar esta página quando mudarem o contrato de `X-Request-Id`, a normalização de rotas no `AppExceptionFilter`, o comportamento do `/health/liveness`, o módulo `ObservabilityModule.forApi()` ou os mocks dos indicadores de health.
