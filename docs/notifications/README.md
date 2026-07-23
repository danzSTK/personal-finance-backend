---
area: notifications
type: index
status: current
last_reviewed: 2026-07-23
---

# Notifications

Documentação do contexto de notificações.

O módulo de notifications é responsável por decidir quais mensagens transacionais devem existir, persistir a intenção idempotente de envio e delegar o envio real ao `MailService`.

## Infraestrutura Atual

- Intenções persistidas em `email_messages`.
- Fila BullMQ `notifications.email`.
- Job `send-email-message`.
- Worker `EmailMessageProcessor`, exclusivo de `WorkerModule`.
- Envio por `MailService`, com provider real definido pela configuração de mail.

## Separação De Processos

| Módulo | Processo | Responsabilidade |
|---|---|---|
| `NotificationsPersistenceModule` | API e worker | repository de `email_messages` |
| `NotificationsProducerModule` | API e worker | cria intenções e adiciona jobs |
| `NotificationsEventHandlersModule` | worker | reage aos eventos de domínio |
| `NotificationsWorkerModule` | worker | provider de e-mail, processor e reconciliação |

A API não carrega `MailModule` nem `EmailMessageProcessor`. Ela pode persistir uma intenção e produzir um job, mas o envio ocorre somente no worker.

## Fluxo Confiável

1. Um caso de uso ou handler persiste uma intenção idempotente em `email_messages`.
2. O producer adiciona `send-email-message` em `notifications.email` com `jobId` derivado do id da intenção.
3. O worker carrega a intenção, envia pelo `MailService` e atualiza seu estado.
4. Se o commit no PostgreSQL ocorrer e `Queue.add` falhar, o reconciliador seleciona intenções antigas `PENDING`/`FAILED_RETRYABLE` e repete o enqueue.

Estados terminais (`SENT`, `FAILED_PERMANENT`, `CANCELED`) não são reconciliados. Repetições do reconciliador são seguras porque o `jobId` é determinístico e a intenção possui chave de idempotência.

## Configuração Operacional

```text
BULLMQ_DEFAULT_CONCURRENCY
EMAIL_ENQUEUE_RECONCILE_INTERVAL_MS
EMAIL_ENQUEUE_RECONCILE_BATCH_SIZE
EMAIL_ENQUEUE_STALE_AFTER_MS
```

Detalhes de health, backlog e recuperação: [Worker operations](../platform/worker-operations.md).

## Mapa

- [Templates de e-mail](./email-templates/README.md)
