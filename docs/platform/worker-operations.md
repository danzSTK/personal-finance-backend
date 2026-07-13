---
area: platform
type: runbook
status: current
related:
  - ./queue-infrastructure.md
  - ../events/README.md
  - ../notifications/README.md
  - ../deploy.md
---

# Worker Operations

O worker é um application context NestJS sem servidor HTTP. Ele processa outbox, handlers EventEmitter2, jobs de e-mail e reconciliação de enqueue.

## Comandos

Execute em `api/`:

```bash
npm run start:worker:dev
npm run start:worker:prod
npm run health:worker
```

O health one-shot retorna `0` somente quando PostgreSQL, Redis de cache, Redis BullMQ e o heartbeat da instância estão disponíveis. Ele não registra processors, handlers ou schedulers.

## Heartbeat

A chave usa o formato:

```text
<BULLMQ_PREFIX>:worker:heartbeat:<WORKER_INSTANCE_ID|hostname>
```

`WORKER_HEARTBEAT_INTERVAL_MS` deve ser menor que `WORKER_HEARTBEAT_TTL_MS`. Em orquestradores, configure `WORKER_INSTANCE_ID` com um identificador único e estável por instância.

## Consultas PostgreSQL

Backlog da outbox:

```sql
SELECT status, count(*)
FROM outbox_messages
GROUP BY status
ORDER BY status;
```

Mensagens mortas ou locks vencidos:

```sql
SELECT id, event_name, attempts, last_error, locked_by, locked_until, updated_at
FROM outbox_messages
WHERE status = 'DEAD'
   OR (status = 'PROCESSING' AND locked_until <= now())
ORDER BY updated_at ASC
LIMIT 100;
```

Intenções de e-mail antigas que deveriam ser reenfileiradas:

```sql
SELECT id, type, status, attempts_count, created_at, updated_at
FROM email_messages
WHERE status IN ('PENDING', 'FAILED_RETRYABLE')
  AND created_at <= now() - interval '30 seconds'
ORDER BY created_at ASC
LIMIT 100;
```

Não registre `recipient_email`, `template_params`, tokens ou secrets em logs e alertas.

## Alertas Mínimos

- heartbeat ausente por mais de dois TTLs;
- crescimento contínuo de `PENDING`/`FAILED` na outbox;
- qualquer aumento de mensagens `DEAD`;
- jobs BullMQ falhos acima do baseline;
- intenções `PENDING`/`FAILED_RETRYABLE` mais antigas que o SLA de envio.

## Shutdown E Recuperação

Em SIGTERM, o worker para novos claims, interrompe timers e aguarda o lote ativo até `WORKER_SHUTDOWN_TIMEOUT_MS`. Leases não concluídos podem ser recuperados por outra instância após `locked_until`.

Nunca limpe Redis BullMQ ou `outbox_messages` durante rollback. Para voltar temporariamente, pare o worker novo, restaure a imagem anterior e preserve PostgreSQL e ambos os Redis.

## Escala

É permitido executar múltiplas instâncias. `FOR UPDATE SKIP LOCKED`, ownership por `locked_by`, renovação de lease, handlers idempotentes e `jobId` determinístico protegem a concorrência. API e workers precisam compartilhar o mesmo PostgreSQL e a mesma configuração BullMQ.
