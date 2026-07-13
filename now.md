# Retomada - API e Worker Separados

Este arquivo e o ponto de entrada para retomar o backend depois da separacao entre API HTTP e worker assincrono.

## Primeiro Passo Ao Voltar

Na raiz do backend:

```bash
git status
git log -1 --stat
git show --stat --oneline HEAD
git show HEAD -- docs/specs/platform/api-worker-separation/specs/design.md
```

Depois leia, nesta ordem:

1. `now.md` (este arquivo);
2. `docs/specs/platform/api-worker-separation/specs/design.md`;
3. `docs/specs/platform/api-worker-separation/specs/decisions.md`;
4. `docs/specs/platform/api-worker-separation/specs/tasks.md`;
5. `docs/platform/worker-operations.md`;
6. `docs/events/README.md`;
7. `docs/notifications/README.md`.

## Modelo Mental Atual

O projeto continua sendo um monolito modular NestJS:

- um repositorio;
- um `package.json`;
- uma imagem Docker;
- um PostgreSQL e o mesmo schema;
- dois processos com composition roots diferentes.

### Processo API

Entrypoint: `api/src/main.ts`.

Root: `api/src/app/app.module.ts`.

Responsabilidades:

- receber HTTP;
- autenticar e validar requests;
- executar use cases;
- persistir aggregates;
- gravar eventos em `outbox_messages` na mesma transacao;
- persistir intencoes em `email_messages`;
- produzir jobs BullMQ quando aplicavel.

A API nao registra EventEmitter2, handlers de dominio, dispatcher da outbox, processor BullMQ ou `MailModule`.

### Processo Worker

Entrypoint: `api/src/worker.ts`.

Root: `api/src/app/worker.module.ts`.

Responsabilidades:

- buscar mensagens da outbox;
- reidratar eventos;
- publicar eventos no EventEmitter2 local;
- executar handlers idempotentes;
- reconciliar intencoes de e-mail que nao entraram na fila;
- consumir BullMQ;
- enviar e-mails pelo `MailService`.

O worker usa `NestFactory.createApplicationContext`: nao abre HTTP, Swagger ou controllers.

## Fluxos Entre Processos

### Evento De Dominio

```text
HTTP -> API/use case -> PostgreSQL (aggregate + outbox na mesma transacao)
-> Worker reivindica outbox -> EventEmitter2 local -> handlers
-> Worker marca outbox como PUBLISHED
```

O EventEmitter2 nao comunica API e worker. A fronteira duravel entre eles e a tabela `outbox_messages`.

### Envio De E-mail

```text
API ou handler -> persiste email_messages -> Queue.add com jobId deterministico
-> Redis BullMQ -> EmailMessageProcessor no worker -> MailService/provider
```

Se o commit de `email_messages` funcionar e `Queue.add` falhar, `EmailMessageEnqueueReconciler` encontra intencoes antigas `PENDING` ou `FAILED_RETRYABLE` e tenta o enqueue novamente.

## Exemplo Futuro: Change User Password

Antes de implementar, crie a spec em:

```text
docs/specs/users/change-user-password/specs/
├── requirements.md
├── design.md
├── tasks.md
└── decisions.md
```

Fluxo recomendado:

1. `ChangeUserPasswordUseCase` valida senha atual e politica da nova senha.
2. Dentro da mesma transacao, salva o novo hash, revoga sessoes/tokens conforme a regra e grava `user.password.changed` na outbox.
3. A API responde sem chamar Brevo ou `MailService` diretamente.
4. O worker reivindica `user.password.changed` e o reidrata.
5. Um handler em `NotificationsEventHandlersModule` chama `CreatePasswordChangedEmailMessageUseCase`.
6. Esse use case cria uma linha idempotente em `email_messages`, por exemplo com chave `email:password-changed:user:<userId>:event:<eventId>`.
7. `EmailJobQueueProducer` adiciona `send-email-message` na fila `notifications.email`.
8. `EmailMessageProcessor` carrega a intencao e chama `SendEmailMessageUseCase`/`MailService`.
9. Em falha de Redis depois do commit, o reconciliador recupera o enqueue.

Arquivos/capacidades que provavelmente serao adicionados:

```text
users/domain/events/user-password-changed.event.ts
users/infrastructure/events/user-password-changed-event.rehydrator.ts
notifications/application/handlers/enqueue-password-changed-email.handler.ts
notifications/application/use-cases/create-password-changed-email-message/
notifications/email template e idempotency key
```

Tambem sera necessario:

- registrar o hydrator em `OutboxRehydratorsModule`;
- registrar o handler no modulo de handlers de notifications;
- adicionar o novo tipo/template aceito por `EmailMessage`;
- garantir idempotencia no banco e no `jobId`;
- atualizar `docs/events`, `docs/notifications` e testes;
- nunca incluir senha, hash, token ou dados completos de template no evento/log.

## Onde Cada Modulo Fica

Padrao usado nos contextos afetados:

```text
<domain>-core.module.ts            repositories e use cases
<domain>.module.ts                 facade HTTP/controllers
<domain>-event-handlers.module.ts  consumers exclusivos do worker
```

Notifications foi separado em:

```text
notifications-persistence.module.ts
notifications-producer.module.ts
notifications-event-handlers.module.ts
notifications-worker.module.ts
```

Outbox foi separado em:

```text
outbox-persistence.module.ts
outbox-writer.module.ts
outbox-registry.module.ts
outbox-dispatcher.module.ts
```

Ao criar um use case HTTP, importe capacidades core/producer. Ao criar um consumer, registre-o somente no grafo do worker.

## Como Subir E Testar

Na raiz:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f api worker
```

API:

```bash
curl http://localhost:3000/health/liveness
curl http://localhost:3000/health/readiness
```

Em `api/`:

```bash
npm run build
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run health:worker
```

Desenvolvimento sem Docker para os processos Node:

```bash
npm run start:dev
npm run start:worker:dev
```

Use terminais separados. `PROCESS_ROLE` protege contra iniciar o entrypoint errado.

## Validacoes Ja Executadas Na Migracao

- build e lint;
- testes unitarios completos;
- E2E existente;
- imagem Docker com usuario nao root;
- API e worker em containers separados;
- liveness da API;
- health do worker;
- SIGTERM do worker com exit code 0.

## Validacoes Ainda Pendentes

Consulte `docs/specs/platform/api-worker-separation/specs/tasks.md`. Os principais itens abertos sao:

- concorrencia PostgreSQL real com duas instancias e `SKIP LOCKED`;
- worker antigo tentando finalizar depois de perder o lease;
- `EXPLAIN (ANALYZE, BUFFERS)` com volume representativo;
- duas instancias do reconciliador/worker;
- indisponibilidade e recuperacao controlada de PostgreSQL e Redis;
- smoke completo API -> outbox -> handler -> BullMQ -> e-mail noop;
- separacao real de secrets em um deploy de teste.

## Regras Que Nao Devem Ser Quebradas

- API nao importa processors, handlers, EventEmitter2 ou `MailModule`.
- Worker nao importa controllers, JWT/Passport, Swagger ou throttling HTTP.
- Evento de dominio e aggregate devem ser persistidos na mesma transacao.
- Handlers e jobs operam com semantica at-least-once e precisam ser idempotentes.
- Updates finais da outbox exigem o mesmo `lockedBy` e status `PROCESSING`.
- Nao limpar outbox, BullMQ ou volumes para corrigir deploy.
- Nao criar migration sem ler `docs/database/schema.md` e atualizar a spec.
