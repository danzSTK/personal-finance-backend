---
area: events
type: guide
status: current
related:
  - ./README.md
  - ./events-map.canvas
---

# Add Event

Use este guia quando um módulo precisar anunciar um fato para outros módulos com resiliência via outbox.

## Quando Criar Evento

Crie evento quando:

- algo importante aconteceu no domínio;
- outro módulo precisa reagir;
- a reação não deve deixar o emissor acoplado ao consumidor;
- a perda do evento causaria inconsistência de produto.

Não crie evento para substituir chamada direta quando o comportamento faz parte do mesmo caso de uso e precisa ser síncrono.

## Estrutura Recomendada

Para um módulo `users`, o padrão atual é:

```text
api/src/modules/users/
├── domain/events/user-created.event.ts
├── infrastructure/events/user-created-event.rehydrator.ts
└── users-events.module.ts
```

Handlers consumidores ficam no módulo que executa a reação:

```text
api/src/modules/accounts/application/handlers/provision-default-account-on-user.handler.ts
```

## 1. Criar O Domain Event

O evento fica no domínio do módulo que produz o fato.

Ele deve implementar `DomainEvent` e expor:

- `eventName`;
- `eventVersion`;
- `aggregateType`;
- `aggregateId`;
- `occurredAt`;
- `deduplicationKey`, quando fizer sentido;
- `toPayload()`;
- método `create()` para evento novo;
- método `rehydrate()` para reconstrução a partir da outbox.

Exemplo de intenção:

```ts
export class UserCreatedEvent implements DomainEvent<UserCreatedEventPayload> {
  public static readonly eventName = AppEventNames.UserCreated;
  public static readonly aggregateType = 'User';
  public static readonly eventVersion = 1;

  toPayload(): UserCreatedEventPayload {
    return {
      userId: this.userId,
      status: this.status,
      email: this.email.value,
    };
  }
}
```

## 2. Registrar O Evento No Aggregate

O aggregate deve estender `AggregateRoot`.

Quando a regra de domínio gerar o fato, chame `addDomainEvent()`.

Exemplo atual:

```ts
static create(props: UserProps, id: string) {
  const user = new User(props, id);

  user.addDomainEvent(UserCreatedEvent.create(user.id, user.status, user.email));

  return user;
}
```

O aggregate não publica nada. Ele só guarda eventos pendentes enquanto está em memória.

## 3. Persistir Eventos Na Outbox

O use case que salva o aggregate também deve salvar os eventos.

Regras:

- salve o aggregate primeiro;
- puxe eventos do aggregate original;
- grave na outbox com o mesmo `manager`;
- garanta transação externa ou abra uma transação própria.

Exemplo de forma:

```ts
const savedUser = await this.userRepository.save(user, { manager });
const domainEvents = user.pullDomainEvents();

await this.outboxWriteService.storeEvents(domainEvents, { manager });

return savedUser;
```

## 4. Criar O Hydrator

O hydrator fica em infraestrutura do módulo produtor.

Ele deve implementar `EventRehydrator`.

Responsabilidades:

- identificar `eventName`;
- identificar `eventVersion`;
- validar o payload vindo do banco;
- chamar o `rehydrate()` do evento.

Exemplo de forma:

```ts
@Injectable()
export class UserCreatedEventHydrator implements EventRehydrator {
  readonly eventName = UserCreatedEvent.eventName;
  readonly eventVersion = UserCreatedEvent.eventVersion;

  rehydrate(input: RehydrateEventInput): UserCreatedEvent {
    const payload = UserCreatedPayloadSchema.parse(input.payload);

    return UserCreatedEvent.rehydrate({
      userId: payload.userId,
      status: payload.status,
      email: payload.email,
      occurredAt: input.occurredAt,
    });
  }
}
```

O payload entra como `unknown`. O hydrator é a fronteira que valida runtime antes de reconstruir o evento.

## 5. Exportar Hydrators Do Módulo De Negócio

Cada módulo que produz eventos deve ter um módulo pequeno para providers de hydrators.

Exemplo:

```ts
@Module({
  providers: [UserCreatedEventHydrator],
  exports: [UserCreatedEventHydrator],
})
export class UsersEventsModule {}
```

Esse módulo não deve importar o dispatcher da outbox. Ele só fornece providers do módulo de negócio.

## 6. Registrar No Módulo De Composição

O registro acontece em `OutboxRehydratorsModule`.

Para um novo evento:

- importe o módulo que exporta o hydrator;
- injete o hydrator;
- registre no `EventRegistry` no `onModuleInit()`.

Exemplo:

```ts
@Module({
  imports: [OutboxRegistryModule, UsersEventsModule],
})
export class OutboxRehydratorsModule implements OnModuleInit {
  constructor(
    private readonly eventRegistry: EventRegistry,
    private readonly userCreatedEventHydrator: UserCreatedEventHydrator,
  ) {}

  onModuleInit(): void {
    this.eventRegistry.register(this.userCreatedEventHydrator);
  }
}
```

O `shared/outbox` não deve importar módulos de domínio como `users`, `accounts` ou `categories`.

O `OutboxRehydratorsModule` pertence ao grafo do worker. A API importa apenas `OutboxWriterModule` por meio da facade de escrita.

## 7. Criar Handler Consumidor

Handler fica no módulo que reage ao evento.

Exemplo atual:

```ts
@Injectable()
export class ProvisionDefaultAccountOnUserHandler {
  constructor(private readonly createDefaultAccountUseCase: CreateDefaultAccountUseCase) {}

  @OnEvent(UserCreatedEvent.eventName)
  async handle(event: UserCreatedEvent): Promise<Account> {
    return await this.createDefaultAccountUseCase.execute({ userId: event.userId });
  }
}
```

O handler deve chamar use case. Evite concentrar regra de negócio diretamente no handler.

Exporte o handler por um módulo `<Domain>EventHandlersModule` e registre esse módulo em `WorkerEventConsumersModule`. Não importe handlers no módulo HTTP/API.

## 8. Garantir Idempotência

Todo handler de outbox deve ser idempotente.

Checklist:

- se repetir o mesmo evento, o resultado continua correto;
- se dois workers tentarem ao mesmo tempo, o banco impede duplicidade;
- unique violation esperada pode ser tratada como sucesso;
- efeitos externos futuros, como email, precisam de deduplication própria.

Exemplo atual:

- `CreateDefaultAccountUseCase` busca `CASH` existente;
- `UQ_accounts_user_cash` impede duas `CASH` por usuário;
- `isPostgresUniqueViolation()` permite tratar corrida como sucesso idempotente.

## 9. Atualizar Documentação E Testes

Ao criar evento novo, atualize:

- catálogo em [Events](./README.md);
- mapa visual em [Events map](./events-map.canvas);
- nota própria do evento em `docs/events/<event-name>.md`;
- documentação do módulo produtor;
- documentação do módulo consumidor;
- docs de integração se o frontend observar algum efeito assíncrono;
- testes do use case produtor;
- testes do handler/use case consumidor;
- teste ou validação do hydrator quando o payload tiver risco de quebra.
