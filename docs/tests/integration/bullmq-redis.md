# `bullmq-redis.integration-spec.ts`

## Objetivo e cobertura

Valida BullMQ contra Redis real: deduplicação por job ID, processamento com dois
workers concorrentes e ciclo de vida do heartbeat, incluindo expiração sem shutdown
gracioso.

## Dependências

Usa um container `redis:7-alpine`, BullMQ e ioredis. Não usa PostgreSQL, NestJS,
provider externo ou credencial real. Prefixos exclusivos isolam filas; workers,
queue events, filas, clientes e container são fechados no teardown.

## Execução

```bash
npm run test:integration -- --runTestsByPath test/bullmq-redis.integration-spec.ts
npm run test:integration
```

Atualizar ao mudar Redis, BullMQ, job IDs, concorrência, heartbeat ou cleanup.

