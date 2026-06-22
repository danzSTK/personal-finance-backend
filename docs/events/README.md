---
area: events
type: architecture
status: current
related:
  - ../Excalidraw/Events-flow.excalidraw.md
  - ./events-map.canvas
  - ./add-event.md
  - ./user-created.md
  - ./user-avatar-updated.md
---

# Events

Eventos são usados para comunicar algo que já aconteceu em um domínio sem acoplar diretamente o emissor aos efeitos colaterais.

Hoje o padrão da plataforma é:

- o domínio cria `DomainEvent` em memória;
- o use case persiste o aggregate e grava os eventos na outbox dentro da mesma transação;
- o processor da outbox publica o evento depois do commit;
- handlers de outros módulos reagem pelo `EventEmitter2`.

Mapa visual geral: [Events map](./events-map.canvas).

Desenho do fluxo técnico atual: [Events flow](../Excalidraw/Events-flow.excalidraw.md).

Guia para criar novos eventos: [Add event](./add-event.md).

## Eventos Documentados

| Evento                                          | Status                             | Produtor | Consumidores                                                      |
| ----------------------------------------------- | ---------------------------------- | -------- | ----------------------------------------------------------------- |
| [user.created](./user-created.md)               | current                            | `users`  | `accounts` atual; `categories` e `notifications/email` planejados |
| [user.avatar.updated](./user-avatar-updated.md) | current contract; planned emission | `users`  | remoção do asset anterior planejada em `assets`                   |

## Por Que Outbox

Usamos o Outbox Pattern para não perder eventos críticos quando eles dependem de uma escrita no banco.

Sem outbox, um use case poderia salvar o usuário e emitir o evento em memória antes do commit. Se a transação desse rollback depois, outro módulo poderia reagir a algo que nunca existiu no banco.

Com outbox:

- o dado principal e a mensagem ficam na mesma transação;
- rollback remove os dois;
- commit torna os dois visíveis;
- falhas de handler/publicação viram retry controlado.

## Peças Do Padrão

| Peça                      | Arquivo                                                                 | Responsabilidade                                                     |
| ------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `DomainEvent`             | `api/src/shared/domain/domain-event.interface.ts`                       | Contrato mínimo de um evento persistível/publicável                  |
| `AggregateRoot`           | `api/src/shared/domain/aggregate-root.ts`                               | Guarda eventos gerados por uma entidade enquanto ela está em memória |
| `OutboxWriteService`      | `api/src/shared/outbox/services/outbox-write.service.ts`                | Recebe eventos do use case e grava mensagens na outbox               |
| `OutboxEventMapper`       | `api/src/shared/outbox/mappers/outbox-event.mapper.ts`                  | Transforma `DomainEvent` em payload persistível                      |
| `OutboxMessageOrmEntity`  | `api/src/shared/outbox/persistence/outbox-message-orm.entity.ts`        | Representa a tabela `outbox_messages`                                |
| `OutboxMessageRepository` | `api/src/shared/outbox/persistence/outbox-message.repository.ts`        | Salva, reivindica e atualiza mensagens da outbox                     |
| `OutboxProcessorService`  | `api/src/shared/outbox/services/outbox-processor.service.ts`            | Processa mensagens prontas em intervalos                             |
| `EventRegistry`           | `api/src/shared/outbox/event-registry.ts`                               | Encontra o hydrator correto para reconstituir um evento salvo        |
| `EventRehydrator`         | `api/src/shared/outbox/interfaces/outbox-event-rehydrator.interface.ts` | Contrato de reidratação de um evento específico                      |
| `AppEventPublisher`       | `api/src/shared/events/app-event-publisher.service.ts`                  | Publica o `DomainEvent` no EventEmitter                              |
| `OutboxRehydratorsModule` | `api/src/app/composition/outbox-rehydrators.module.ts`                  | Registra hydrators disponíveis no boot da aplicação                  |

## Escrita Do Evento

Eventos não são publicados no momento em que a entidade é manipulada. A entidade apenas registra o fato em memória.

Exemplos atuais:

- `User.create()` adiciona `UserCreatedEvent` no aggregate.
- `User.changeAvatarAsset()` adiciona `UserAvatarUpdatedEvent` quando a referência realmente muda.
- `CreateUserUseCase` salva o usuário.
- O mesmo use case chama `user.pullDomainEvents()`.
- `OutboxWriteService.storeEvents()` grava as mensagens usando o mesmo `EntityManager` da transação.

Pontos importantes:

- O evento deve ser drenado do aggregate original criado/manipulado no use case.
- Não use o domain object reconstituído pelo repository para puxar eventos; ele representa estado salvo, não os eventos pendentes.
- A escrita na outbox deve usar o mesmo `manager` da transação do dado principal.
- Se o use case puder ser chamado sem transação externa, ele deve abrir uma transação própria ou usar uma abstração equivalente.

## Processamento Da Outbox

`OutboxProcessorService` roda com `@Interval`.

Cada ciclo tenta reivindicar um lote de mensagens prontas usando `OutboxMessageRepository.claimReadyBatch()`.

Esse claim é feito com SQL direto porque precisa ser atômico:

- escolhe mensagens `PENDING`, `FAILED` prontas para retry ou `PROCESSING` com lock expirado;
- usa `FOR UPDATE SKIP LOCKED` para permitir múltiplos workers sem pegar a mesma mensagem;
- marca mensagens como `PROCESSING`;
- incrementa `attempts`;
- define `lockedBy` e `lockedUntil`;
- retorna somente mensagens que este worker pode processar.

Depois do claim:

- `EventRegistry.rehydrate()` transforma a mensagem em `DomainEvent`;
- `AppEventPublisher.emitAsync()` publica no EventEmitter;
- sucesso chama `markPublished()`;
- erro chama `markFailed()`, que agenda retry ou move para `DEAD`.

## Hydrator

Hydrator é a peça que transforma uma mensagem persistida em `outbox_messages` de volta no `DomainEvent` correto.

Ele existe porque o banco guarda JSON, mas os handlers esperam um objeto de evento de domínio.

Um hydrator deve:

- implementar `EventRehydrator`;
- declarar `eventName`;
- declarar `eventVersion`;
- validar `payload` recebido como `unknown`;
- chamar um método de reconstituição do evento, como `UserCreatedEvent.rehydrate()`.

Exemplos atuais:

- `UserCreatedEventHydrator` fica em `api/src/modules/users/infrastructure/events/`.
- `UserAvatarUpdatedEventHydrator` fica no mesmo módulo.
- Ambos validam o payload com Zod e reconstituem a versão correta do evento.

Hydrator é infraestrutura do módulo, não domínio. Ele pode depender de validação runtime, como Zod, sem contaminar entidade ou evento de domínio com preocupação de borda.

## Inicialização Dos Hydrators

Hydrators são registrados no boot da aplicação.

O desenho atual é uma camada de composição:

- cada módulo de negócio exporta seus hydrators por um módulo específico, como `UsersEventsModule`;
- `OutboxRehydratorsModule` importa esses módulos;
- no `onModuleInit`, registra cada hydrator no `EventRegistry`;
- o `EventRegistry` guarda os hydrators por chave `eventName + eventVersion`.

Isso evita que `shared/outbox` importe módulos de negócio. O shared define o contrato; os módulos de negócio fornecem implementações; a composição junta tudo.

## Handlers

Handlers são consumidores de eventos publicados pelo EventEmitter.

Exemplo atual:

- `ProvisionDefaultAccountOnUserHandler` escuta `UserCreatedEvent.eventName`;
- ele chama `CreateDefaultAccountUseCase`;
- o use case cria a `CASH` default do usuário.

Handlers precisam ser idempotentes. O mesmo evento pode ser tentado novamente por retry, lock expirado, deploy, falha parcial ou concorrência entre workers.

Idempotência deve vir de regra de aplicação mais garantia no banco. Para `CASH` default, usamos:

- busca por `CASH` existente;
- unique index `UQ_accounts_user_cash`;
- tratamento de unique violation como sucesso idempotente quando outra execução criou a conta antes.

## Estado Da Mensagem

Estados principais em `outbox_messages`:

| Status       | Significado                                       |
| ------------ | ------------------------------------------------- |
| `PENDING`    | Mensagem gravada e pronta para primeira tentativa |
| `PROCESSING` | Mensagem reivindicada por um worker               |
| `PUBLISHED`  | Evento publicado com sucesso                      |
| `FAILED`     | Falhou, mas ainda pode tentar novamente           |
| `DEAD`       | Esgotou tentativas                                |

Campos operacionais importantes:

- `deduplicationKey`: evita duplicação lógica de mensagens quando aplicável;
- `attempts`: conta tentativas;
- `maxAttempts`: limite de tentativas;
- `nextRetryAt`: quando uma mensagem falhada pode tentar de novo;
- `lockedBy`: identifica o worker que reivindicou a mensagem;
- `lockedUntil`: evita mensagem presa para sempre se o worker morrer;
- `lastError`: registra o erro mais recente.

## Limites Atuais

- O outbox publica eventos dentro da mesma aplicação NestJS, usando EventEmitter.
- Ainda não é uma fila distribuída externa.
- Handlers continuam precisando de idempotência própria.
- O registry atual registra hydrators explicitamente no módulo de composição.
- Eventos sem hydrator registrado falham no processor e entram em retry/falha.
