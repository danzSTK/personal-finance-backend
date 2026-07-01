---
area: notifications
feature: welcome-email
type: spec-design
status: implemented
related:
  - ./requirements.md
  - ./decisions.md
  - ../../../../notifications/email-templates/welcome-email.md
  - ../../../../database/schema.md
---

# Design - Welcome Email

## Arquitetura

Criar módulo:

```text
api/src/modules/notifications/
├── domain/
│   ├── entities/
│   │   └── email-message.entity.ts
│   ├── repositories/
│   │   └── email-message.repository.interface.ts
│   └── value-objects/
│       └── email-template-key.value-object.ts
├── application/
│   ├── handlers/
│   │   └── enqueue-welcome-email-on-user-created.handler.ts
│   ├── queues/
│   │   └── email-job-queue.port.ts
│   └── use-cases/
│       ├── create-welcome-email-message/
│       │   ├── create-welcome-email-message.dto.ts
│       │   └── create-welcome-email-message.use-case.ts
│       └── send-email-message/
│           ├── send-email-message.dto.ts
│           └── send-email-message.use-case.ts
├── infrastructure/
│   ├── mappers/
│   │   └── email-message.mapper.ts
│   ├── persistence/
│   │   ├── email-message-orm.entity.ts
│   │   └── email-message.repository.ts
│   └── queues/
│       ├── bullmq-email-job-queue.ts
│       └── email-message.processor.ts
└── notifications.module.ts
```

Não criar controller HTTP nesta feature.

## Documentação De Templates

Criar:

```text
docs/notifications/README.md
docs/notifications/email-templates/README.md
docs/notifications/email-templates/welcome-email.md
```

Cada template deve documentar:

- `template_key`;
- provider;
- provider template id;
- tipo de e-mail;
- caso de uso;
- trigger;
- queue/job relacionado;
- parâmetros obrigatórios;
- parâmetros opcionais;
- origem de cada parâmetro;
- regras de idempotência;
- observações de segurança.

O template `welcome-email` terá:

```text
template_key: welcome-email
provider: brevo
provider_template_id: 2
type: WELCOME
trigger: user.created
idempotency_key: email:welcome:user:<userId>
```

## Banco De Dados

Criar tabela `email_messages`:

```text
id uuid primary key
type varchar(50) not null
recipient_email varchar(320) not null
recipient_name varchar(120) null
provider varchar(50) not null
template_key varchar(100) not null
provider_template_id varchar(100) not null
template_params jsonb not null default '{}'::jsonb
idempotency_key varchar(255) not null
status varchar(30) not null
provider_message_id varchar(255) null
attempts_count integer not null default 0
last_error_code varchar(100) null
last_error_message text null
processing_at timestamptz null
sent_at timestamptz null
failed_at timestamptz null
created_at timestamptz not null
updated_at timestamptz not null
```

Índices:

```text
UQ_email_messages_idempotency_key unique(idempotency_key)
idx_email_messages_status_created_at(status, created_at)
idx_email_messages_recipient_email_created_at(recipient_email, created_at)
idx_email_messages_type_created_at(type, created_at)
```

Trigger:

```text
trg_email_messages_updated_at -> set_updated_at()
```

Não criar:

```text
bullmq_job_id
job_id
email_delivery_attempts
```

## Estados

Estados iniciais:

```text
PENDING
PROCESSING
SENT
FAILED_RETRYABLE
FAILED_PERMANENT
CANCELED
```

Regras:

- `PENDING`: intenção criada, ainda não enviada;
- `PROCESSING`: worker iniciou envio;
- `SENT`: provider aceitou;
- `FAILED_RETRYABLE`: falha que pode retentar;
- `FAILED_PERMANENT`: falha que não deve retentar;
- `CANCELED`: intenção cancelada antes de envio.

## Idempotência

`idempotency_key` do welcome email:

```text
email:welcome:user:<userId>
```

Essa chave é persistida no banco e pode usar `:`.

`jobId` da fila deve ser derivado e sanitizado:

```text
email-message-<emailMessageId>
```

Motivo: BullMQ pode restringir `:` em `jobId`. A chave de negócio continua legível no banco; o identificador da fila fica compatível com a tecnologia.

O `jobId` não será persistido no banco. Para debug:

```text
jobId = email-message-<emailMessage.id>
```

## Fluxo

```text
UserCreatedEvent
-> EnqueueWelcomeEmailOnUserCreatedHandler
-> CreateWelcomeEmailMessageUseCase
   -> cria EmailMessage com idempotency_key única
   -> trata unique violation como sucesso idempotente
-> EmailJobQueue.enqueueEmailMessage(emailMessage.id)
-> BullMQ job { emailMessageId }
-> EmailMessageProcessor
-> SendEmailMessageUseCase
   -> carrega EmailMessage
   -> marca PROCESSING
   -> chama MailService.send
   -> marca SENT ou falha
```

## Template Params

Mapper do welcome email:

```ts
{
  first_name: string;
  dashboard_url: string;
  support_url: string;
  support_url_label: string;
  preferences_url: string;
}
```

Origem:

- `first_name`: `UserCreatedEvent.email` ou dados disponíveis no evento/use case; se o evento atual não trouxer nome, usar fallback configurado;
- `dashboard_url`: `FRONTEND_URL` + rota configurada;
- `support_url`: `SUPPORT_URL`;
- `support_url_label`: `SUPPORT_URL_LABEL`;
- `preferences_url`: `FRONTEND_URL` + rota configurada.

Como `UserCreatedEvent` atual carrega `userId`, `status` e `email`, há duas opções:

- v1 simples: `first_name` usa fallback seguro até o evento passar a carregar nome;
- v1 enriquecida: use case busca o usuário pelo `userId` para obter `firstName`.

Preferência: buscar usuário pelo `userId`, se o módulo `users` expuser use case/porta adequada sem violar dependências.

## Configuração

Adicionar variáveis:

```text
NOTIFICATIONS_DASHBOARD_PATH=/dashboard
NOTIFICATIONS_EMAIL_PREFERENCES_PATH=/settings/email-preferences
SUPPORT_URL=https://...
SUPPORT_URL_LABEL=Central de ajuda
```

Reusar:

```text
FRONTEND_URL
MAIL_PROVIDER
MAIL_ENABLED
```

## BullMQ

Fila:

```text
notifications.email
```

Job:

```text
send-email-message
```

Payload:

```ts
interface SendEmailMessageJobPayload {
  emailMessageId: string;
}
```

`jobId`:

```text
email-message-<emailMessageId>
```

Não usar `:` no `jobId`.

## Dependências Entre Módulos

`NotificationsModule` pode importar:

- `MailModule`;
- `UsersModule` apenas se precisar buscar primeiro nome;
- `BullModule.registerQueue`;
- `TypeOrmModule.forFeature([EmailMessageOrmEntity])`.

Domínio de notifications não importa infraestrutura.

## Erros

Usar `MailError.retryable` para decidir status:

- retryable: `FAILED_RETRYABLE` e relançar para BullMQ retentar;
- não retryable: `FAILED_PERMANENT`; relançar ou finalizar conforme decisão de worker, mas estado deve ficar permanente.

Mensagens de erro devem ser sanitizadas.

## Migração

Criar TypeORM migration para `email_messages`.

Nunca depender de `synchronize`.

Como `email_messages` possui `updated_at`, a tabela deve usar o trigger padrão `set_updated_at()` documentado em `docs/database/schema.md`. Se a migration de criação já estiver aplicada, adicionar esse trigger por nova migration incremental.

Atualizar `docs/database/schema.md` sempre que a tabela, índices, constraints ou triggers de notifications forem criados ou alterados.

## Metadata Do Provider

O envio via `MailService` deve enviar apenas metadata curta e não sensível para o provider.

Para o fluxo de welcome email:

```text
X-Danfy-Email-Message-Id=<emailMessage.id>
```

Não enviar `idempotency_key` para a Brevo como metadata/header, porque a chave de negócio pode exceder limites do provider e já fica persistida no banco.

## Testes

Adicionar testes para:

- entidade `EmailMessage`;
- criação idempotente por `idempotency_key`;
- unique violation tratada como sucesso idempotente;
- handler `UserCreatedEvent`;
- queue adapter gerando `jobId` sanitizado;
- processor carregando apenas `emailMessageId`;
- `SendEmailMessageUseCase` marcando sucesso;
- falha retentável;
- falha permanente;
- mapper de template params;
- repository/migration conforme padrão do projeto.

## Impacto Em API/Swagger

Sem endpoints HTTP e sem Swagger nesta feature.
