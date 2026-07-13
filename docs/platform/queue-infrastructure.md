---
area: platform
type: guide
status: current
related:
  - ../specs/platform/queue-infrastructure/specs/requirements.md
  - ../specs/platform/queue-infrastructure/specs/design.md
  - ../events/README.md
---

# Queue Infrastructure

O backend usa BullMQ como infraestrutura base para filas e workers assíncronos.

Esta infraestrutura apenas registra a configuração compartilhada. Ela não cria filas concretas, producers, processors ou módulos de domínio.

## Código

Arquivos principais:

```text
api/src/config/queue.config.ts
api/src/shared/jobs/jobs.module.ts
api/src/shared/jobs/constants/queue.constants.ts
```

`JobsModule` configura `BullModule.forRootAsync` com:

- conexão Redis;
- prefixo das chaves BullMQ;
- attempts padrão;
- backoff padrão;
- retenção padrão de jobs concluídos e falhos.

## Variáveis

```text
BULLMQ_REDIS_HOST
BULLMQ_REDIS_PORT
BULLMQ_REDIS_PASSWORD
BULLMQ_REDIS_DB
BULLMQ_PREFIX
BULLMQ_DEFAULT_ATTEMPTS
BULLMQ_BACKOFF_TYPE
BULLMQ_BACKOFF_DELAY_MS
BULLMQ_REMOVE_ON_COMPLETE
BULLMQ_REMOVE_ON_FAIL
BULLMQ_DEFAULT_CONCURRENCY
```

Quando `BULLMQ_REDIS_HOST`, `BULLMQ_REDIS_PORT` ou `BULLMQ_REDIS_PASSWORD` não forem definidos, `queue.config.ts` usa `REDIS_HOST`, `REDIS_PORT` e `REDIS_PASSWORD` como fallback.

## Redis

BullMQ usa Redis dedicado no Docker Compose local:

```text
service: bullmq-redis
container: personal-finance-bullmq-redis
porta interna: 6379
porta local: 6381
volume: bullmqredisdata
maxmemory-policy: noeviction
appendonly: yes
```

Suba a infraestrutura local com:

```bash
docker compose up -d postgres redis bullmq-redis
```

Para a API rodando localmente fora do Docker, use:

```text
BULLMQ_REDIS_HOST=localhost
BULLMQ_REDIS_PORT=6381
BULLMQ_REDIS_DB=0
```

Para a API rodando em container, o `docker-compose.yml` sobrescreve o host para `bullmq-redis` e a porta para `6379`.

Para ambientes não locais, mantenha Redis dedicado para BullMQ.

Configuração recomendada:

```text
maxmemory-policy noeviction
appendonly yes
```

BullMQ depende de chaves internas no Redis. Políticas de eviction voltadas para cache podem remover dados de jobs e reduzir a confiabilidade da fila.

O Redis de cache/sessões continua separado no serviço `redis`, com política adequada para cache. Não aponte BullMQ para esse Redis em produção.

## Como Criar Filas Futuras

Cada feature que precisar de fila deve ter sua própria spec.

O módulo consumidor deve definir:

- nome da fila;
- nomes dos jobs;
- payload versionado e serializável em JSON;
- regra de idempotência e `jobId`, quando necessário;
- attempts/backoff próprios, se o default global não servir;
- concurrency própria, se o default global não servir.

Domínio, entidades e value objects não importam BullMQ.

Quando enfileirar um job fizer parte de regra de aplicação, crie uma porta na camada de aplicação e implemente essa porta na infraestrutura com BullMQ.

## Processos

`PROCESS_ROLE` define o entrypoint e não funciona como feature flag:

- `PROCESS_ROLE=api`: API HTTP, producers e escrita da outbox;
- `PROCESS_ROLE=worker`: dispatcher da outbox, EventEmitter2, handlers, reconciliadores e processors BullMQ.

O processor de e-mail aplica `BULLMQ_DEFAULT_CONCURRENCY`. API e worker devem usar o mesmo `BULLMQ_PREFIX`, database e Redis dedicado.

## Outbox

BullMQ não substitui o outbox.

Use o outbox para garantir que eventos de domínio sejam persistidos junto da transação. Use BullMQ para executar trabalhos assíncronos retentáveis disparados por casos de uso ou handlers desses eventos.

A intenção `email_messages` é persistida antes do enqueue. Um reconciliador exclusivo do worker reenfileira intenções `PENDING` ou `FAILED_RETRYABLE` antigas usando `jobId` determinístico.
