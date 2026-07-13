---
area: events
type: event
status: current
eventName: user.created
eventVersion: 1
aggregateType: User
related:
  - ./README.md
  - ./events-map.canvas
  - ./add-event.md
  - ../accounts/flows/onboarding-cash-account.md
---

# UserCreatedEvent

`user.created` representa o fato de que um usuário novo foi criado e persistido com sucesso.

Ele é o evento de entrada para preparar recursos iniciais do usuário sem acoplar `auth/users` diretamente aos módulos que criam esses recursos.

## Status Atual

| Item | Valor |
|---|---|
| Evento | `user.created` |
| Classe | `UserCreatedEvent` |
| Produtor | `users` |
| Aggregate | `User` |
| Versão | `1` |
| Persistência | `outbox_messages` |
| Publicação | worker: `OutboxProcessorService` via `AppEventPublisher` |

## Produtor

O evento nasce no módulo `users`.

Arquivos principais:

- [user-created.event.ts](../../api/src/modules/users/domain/events/user-created.event.ts)
- [user.entity.ts](../../api/src/modules/users/domain/entities/user.entity.ts)
- [create-user.use-case.ts](../../api/src/modules/users/application/use-cases/create-user/create-user.use-case.ts)

Fluxo de escrita:

1. `User.create()` registra `UserCreatedEvent` no aggregate.
2. `CreateUserUseCase` salva o usuário.
3. `CreateUserUseCase` drena os eventos do aggregate original.
4. `OutboxWriteService` grava o evento na outbox usando o mesmo `EntityManager` da transação.

O evento não deve ser publicado diretamente dentro do fluxo de criação do usuário. Ele deve ser gravado na outbox para só ficar disponível depois do commit.

## Contrato Do Evento

Payload persistido:

| Campo | Tipo | Descrição |
|---|---|---|
| `userId` | `string` | Identificador do usuário criado |
| `status` | `UserStatus` | Status inicial do usuário |
| `email` | `string` | Email principal do usuário |

Metadados relevantes:

| Campo | Valor |
|---|---|
| `eventName` | `user.created` |
| `eventVersion` | `1` |
| `aggregateType` | `User` |
| `aggregateId` | `userId` |
| `deduplicationKey` | `user.created:<userId>` |

`deduplicationKey` evita duplicação lógica da mensagem na outbox para o mesmo usuário. Ela não substitui idempotência dos handlers.

## Hydrator

O hydrator atual é `UserCreatedEventHydrator`.

Arquivo:

- [user-created-event.rehydrator.ts](../../api/src/modules/users/infrastructure/events/user-created-event.rehydrator.ts)

Responsabilidades:

- reconhecer `eventName=user.created`;
- reconhecer `eventVersion=1`;
- validar payload com Zod;
- reconstruir `UserCreatedEvent` usando `UserCreatedEvent.rehydrate()`.

Ele fica em infraestrutura de `users`, não no domínio, porque validação runtime de payload persistido é preocupação de borda.

## Registro No Boot

O registro acontece por composição.

Arquivos principais:

- [users-events.module.ts](../../api/src/modules/users/users-events.module.ts)
- [outbox-rehydrators.module.ts](../../api/src/app/composition/outbox-rehydrators.module.ts)

Fluxo:

1. `UsersEventsModule` exporta `UserCreatedEventHydrator`.
2. `OutboxRehydratorsModule` importa `UsersEventsModule`.
3. `OutboxRehydratorsModule.onModuleInit()` registra o hydrator no `EventRegistry`.
4. O processor usa o registry para reidratar mensagens de `user.created`.

`shared/outbox` não importa `users`. Quem junta contrato compartilhado e implementação de negócio é a camada de composição.

## Consumidores

| Status | Módulo | Handler | Efeito |
|---|---|---|---|
| current | `accounts` | `ProvisionDefaultAccountOnUserHandler` | Cria a account `CASH` default do usuário |
| current | `categories` | `ProvisionDefaultCategoriesOnUserHandler` | Cria categorias iniciais e técnicas |
| current | `auth` | `EnqueueEmailVerificationOnUserCreatedHandler` | Cria challenge e intenção de verificação quando aplicável |
| current | `notifications` | `EnqueueWelcomeEmailOnUserCreatedHandler` | Persiste e enfileira boas-vindas quando aplicável |

Handler atual:

- [provision-default-account-on-user.handler.ts](../../api/src/modules/accounts/application/handlers/provision-default-account-on-user.handler.ts)
- [create-default-account.use-case.ts](../../api/src/modules/accounts/application/use-cases/create-default-account/create-default-account.use-case.ts)

## Idempotência Do Consumidor Atual

O consumidor de `accounts` precisa suportar repetição do mesmo evento.

Garantias atuais:

- `CreateDefaultAccountUseCase` consulta se já existe uma account `CASH` para o usuário;
- o banco tem unique index para impedir mais de uma `CASH` por usuário;
- corrida de concorrência com unique violation esperada é tratada como sucesso idempotente.

Isso é necessário porque outbox pode tentar novamente depois de falha, lock expirado, deploy, reinício do processo ou disputa entre workers.

## Impacto Para Onboarding

`user.created` é o gatilho do onboarding técnico do usuário.

Na V0, o efeito atual é criar a account `CASH` default. O frontend deve considerar que esse preparo pode ser assíncrono por um curto intervalo após sign-up ou OAuth.

Fluxo de produto relacionado:

- [Onboarding CASH Account](../accounts/flows/onboarding-cash-account.md)

## Consumidores De Onboarding

### Default Categories

`user.created` dispara a criação das categorias iniciais do usuário.

O handler precisa ser idempotente por usuário e por categoria seedada.

O desenho implementado:

- criar categorias default visíveis para o usuário;
- criar categorias técnicas `TRANSFER` e `ADJUSTMENT`;
- marcar categorias técnicas como `isSystem=true`;
- manter categorias default visíveis como `isSystem=false`, mesmo quando criadas pelo backend;
- não depender de nomes finais ainda, porque a lista de seeds permanece aberta.

### Welcome Email

O envio de boas-vindas deve ser modelado como job ou efeito externo deduplicável.

O handler de email não deve enviar o mesmo template duas vezes para o mesmo usuário por retry do evento.

## Falhas Esperadas

| Situação | Comportamento esperado |
|---|---|
| Hydrator não registrado | Processor falha a mensagem e agenda retry |
| Payload inválido | Processor registra falha; precisa correção operacional ou nova versão |
| Handler de account falha | Mensagem volta para retry até esgotar tentativas |
| Evento duplicado | Deduplication key e idempotência do handler preservam consistência |
| Usuário rollbackado | Evento não aparece para processamento porque outbox está na mesma transação |
