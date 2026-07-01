---
area: notifications
feature: welcome-email
type: spec-requirements
status: implemented
related:
  - ../../../../events/user-created.md
  - ../../../../platform/email-provider.md
  - ../../../../platform/queue-infrastructure.md
  - ../../../../notifications/email-templates/welcome-email.md
  - ../../../../database/schema.md
---

# Requirements - Welcome Email

## Objetivo

Criar o `NotificationsModule` com o primeiro fluxo de notificação transacional: envio de e-mail de boas-vindas após criação de usuário.

O envio deve usar o `MailService`, o template Brevo `2` e um job assíncrono com idempotência persistida. A feature também deve criar a documentação oficial de templates de e-mail, incluindo provider, identificadores, parâmetros obrigatórios e casos de uso.

## Contexto

O projeto já possui:

- `UserCreatedEvent` publicado via outbox;
- infraestrutura BullMQ em `shared/jobs`;
- `MailService` em `shared/mail`, com adapter Brevo e provider noop;
- documentação de eventos e templates ainda inexistente para notifications.

O fluxo de boas-vindas não deve bloquear a criação do usuário. O evento `user.created` deve gerar uma intenção idempotente de e-mail, e o worker deve executar o envio posteriormente.

## Escopo

Esta spec cobre:

- criação do `NotificationsModule`;
- criação da entidade/tabela `email_messages`;
- criação de idempotência por mensagem;
- criação de catálogo de templates documentado;
- documentação do template `welcome-email`;
- criação de queue e worker de envio de e-mail;
- criação do use case de envio de boas-vindas;
- reação ao `UserCreatedEvent`;
- envio via `MailService` usando template Brevo `2`;
- atualização de status de envio;
- migration TypeORM;
- testes de domínio, use cases, handler, queue/worker e repositório.

## Fora De Escopo

Esta spec não cobre:

- webhooks da Brevo;
- tracking de abertura, clique, bounce ou delivery;
- tabela `email_delivery_attempts`;
- dashboard/admin de e-mails;
- reenvio manual por endpoint HTTP;
- preferências reais de unsubscribe;
- templates além de `welcome-email`;
- confirmação de e-mail;
- troca de provider de e-mail;
- persistir identificadores específicos de BullMQ no banco.

## Regras

- O domínio de notifications não deve importar BullMQ, Brevo, SDKs ou TypeORM.
- O banco deve persistir a intenção de envio em `email_messages`.
- `email_messages` representa uma intenção idempotente de envio, não um log detalhado de tentativas.
- O v1 não deve criar `email_delivery_attempts`.
- O v1 não deve persistir `job_id`, porque o ID do job é derivado de `emailMessage.id`.
- Nenhuma coluna deve se chamar `bullmq_*`.
- A `idempotency_key` pode usar `:` porque é chave de banco/aplicação, não `jobId` da fila.
- O `jobId` usado na fila deve ser sanitizado para formato aceito pelo BullMQ.
- A criação da intenção deve ser idempotente por usuário e tipo de e-mail.
- Unique violation na `idempotency_key` deve ser tratada como sucesso idempotente no handler/use case que cria a intenção.
- O worker deve carregar a mensagem pelo `emailMessageId`, não pelo payload completo.
- O worker deve atualizar `attempts_count`, status, timestamps e último erro.
- O envio real deve usar `MailService`, não o SDK da Brevo diretamente.
- O template `welcome-email` deve ser documentado antes da implementação ser considerada concluída.
- Se a criação da intenção buscar o usuário por `userId` e ele não existir, o fluxo deve falhar com erro de aplicação, sem usar o e-mail do evento como fallback silencioso.
- A porta de enfileiramento de e-mails deve deixar claro que seu papel é producer.
- Quando o processor concluir um job sem envio efetivo, ele deve registrar log operacional com `emailMessageId` e status final.

## Requisitos Funcionais

### REQ-001 - Documentar template de boas-vindas

WHEN a feature estiver implementada
THE SYSTEM SHALL documentar o template `welcome-email`, provider Brevo, provider template id `2`, parâmetros e caso de uso.

### REQ-002 - Registrar intenção idempotente

WHEN `UserCreatedEvent` for processado
THE SYSTEM SHALL criar uma intenção em `email_messages` com `idempotency_key = email:welcome:user:<userId>`.

### REQ-003 - Evitar duplicidade

IF uma intenção com a mesma `idempotency_key` já existir
THEN o sistema deve tratar como sucesso idempotente e não criar outra mensagem.

### REQ-004 - Enfileirar envio

WHEN uma nova intenção de e-mail for criada
THE SYSTEM SHALL enfileirar um job contendo apenas `emailMessageId`.

### REQ-005 - Usar jobId derivado

WHEN o job for criado
THE SYSTEM SHALL usar um `jobId` determinístico derivado de `emailMessage.id`, sem persistir esse valor no banco.

### REQ-006 - Enviar via MailService

WHEN o worker processar o job
THE SYSTEM SHALL buscar `email_messages` por id e chamar `MailService.send` com template Brevo `2`.

### REQ-007 - Enviar parâmetros obrigatórios

WHEN enviar o template `welcome-email`
THE SYSTEM SHALL enviar os parâmetros `first_name`, `dashboard_url`, `support_url`, `support_url_label` e `preferences_url`.

### REQ-008 - Atualizar sucesso

WHEN Brevo aceitar o envio
THE SYSTEM SHALL marcar a mensagem como `SENT`, salvar `provider_message_id` quando existir e preencher `sent_at`.

### REQ-009 - Atualizar falha retentável

WHEN `MailService` falhar com erro retentável
THE SYSTEM SHALL incrementar `attempts_count`, gravar último erro, marcar status retentável e relançar erro para BullMQ aplicar retry.

### REQ-010 - Atualizar falha permanente

WHEN `MailService` falhar com erro não retentável
THE SYSTEM SHALL incrementar `attempts_count`, gravar último erro, marcar status permanente e não deixar o worker mascarar o erro nos registros.

### REQ-011 - Falhar se o usuário do evento não existir

WHEN `UserCreatedEvent` for processado e o usuário referenciado não existir mais
THE SYSTEM SHALL falhar a criação da intenção de welcome email com erro de aplicação.

### REQ-012 - Nomear producer explicitamente

WHEN o handler precisar enfileirar o envio
THE SYSTEM SHALL depender de uma porta com semântica de producer, não de um nome genérico de queue.

### REQ-013 - Registrar jobs concluídos sem envio

WHEN o worker processar um job e o use case retornar `sent = false`
THE SYSTEM SHALL registrar log operacional com o `emailMessageId` e o status final da mensagem.

## Template Params

O template Brevo `2` exige:

| Param               | Obrigatório | Origem                              |
| ------------------- | ----------- | ----------------------------------- |
| `first_name`        | sim         | usuário criado, com fallback seguro |
| `dashboard_url`     | sim         | config de frontend/app              |
| `support_url`       | sim         | config de suporte                   |
| `support_url_label` | sim         | config/constante de suporte         |
| `preferences_url`   | sim         | config de frontend/app              |

## Edge Cases

- IF `firstName` não existir
  THEN usar fallback derivado do e-mail ou nome genérico documentado.

- IF o usuário referenciado por `user.created` não for encontrado
  THEN não criar intenção de e-mail usando apenas o payload do evento; falhar explicitamente para investigação operacional.

- IF links obrigatórios não estiverem configurados
  THEN o boot ou o use case deve falhar de forma explícita antes de enviar e-mail incompleto.

- IF o evento `user.created` for republicado
  THEN a `idempotency_key` deve impedir nova intenção.

- IF o job for duplicado na fila
  THEN o worker deve consultar `email_messages` e respeitar status terminal.

- IF a mensagem já estiver `SENT`
  THEN o worker deve tratar como sucesso idempotente.

- IF o provider estiver `noop`
  THEN o fluxo deve conseguir ser testado sem chamada externa.

## Critérios De Aceite

- Existe `NotificationsModule`.
- Existe documentação de catálogo de templates.
- Existe documentação do template `welcome-email`.
- Existe tabela `email_messages` com migration.
- `docs/database/schema.md` documenta `email_messages`.
- Não existe coluna `bullmq_job_id`.
- Não existe coluna `job_id` no v1.
- Existe unique index em `idempotency_key`.
- O handler de `UserCreatedEvent` é idempotente.
- O job carrega apenas `emailMessageId`.
- O worker usa `MailService`.
- O processor registra jobs concluídos sem envio efetivo.
- A porta de enfileiramento usa nome de producer.
- Os parâmetros do template Brevo `2` são enviados.
- Testes cobrem idempotência, enfileiramento, worker e atualização de status.
