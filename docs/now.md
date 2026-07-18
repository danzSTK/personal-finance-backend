# Retomada - API e Worker Separados

To continue this session, run codex resume 019f5901-cf9a-7f82-b0db-f8579abf3026

Este arquivo e o ponto de entrada para retomar o backend depois da separacao entre API HTTP e worker assincrono.

## Estado Atual De Retomada - 18/07/2026

O ponto em que a revisão parou foi o entendimento da arquitetura criada para separar API e worker. A implementação já existe e está commitada na `develop`, mas ainda não foi promovida para a `main`:

```text
97960d6 refactor(platform): separar api e worker
a0ac4c3 refactor(platform): organizar composition roots
```

Não há código da separação pendente no workspace. O que ainda precisa ser concluído é a revisão conceitual, a execução dos testes pendentes da spec e a decisão de abrir o PR `develop -> main`.

### Produção E Migração De Infraestrutura

- a instância Oracle executa a versão da `main`, sem a separação API/worker;
- nessa versão, API HTTP, scheduler da outbox, EventEmitter2 e processors ainda executam no mesmo processo/container;
- o NGINX está instalado na VM Oracle, fora dos containers, com certificado Cloudflare Origin CA;
- a API da Oracle está em `/opt/danfy/app` e foi validada com Docker;
- a troca do IP de saída da Oracle bloqueou o acesso ao RDS porque o Security Group da AWS ainda autorizava o IP anterior;
- a regra do Security Group foi corrigida e o acesso ao PostgreSQL foi normalizado;
- durante a falha, liveness retornava `200`, readiness retornava `500` e endpoints dependentes do banco aguardavam timeout;
- na última verificação, `api.danfy.app` ainda era atendido pela AWS; confirmar novamente DNS e origem antes de considerar a migração concluída;
- não implantar a separação API/worker na Oracle antes de revisar e validar a feature na `develop`.

### Issues Abertas Durante A Migração

- `#35` registra o incidente já resolvido de indisponibilidade parcial do PostgreSQL;
- `#36` acompanha a correção de indisponibilidade do PostgreSQL em runtime;
- `#37` acompanha a criação do repositório versionado de infraestrutura/NGINX;
- `#38` acompanha a automação de deploy e está bloqueada pela `#37`.

### Objetivo Ao Retomar

1. entender completamente por que API e worker possuem composition roots separados;
2. revisar o fluxo `API -> outbox PostgreSQL -> worker -> EventEmitter2 -> handler`;
3. revisar o fluxo `email_messages -> BullMQ Redis -> worker -> MailService`;
4. confirmar quais módulos pertencem somente à API, somente ao worker ou são compartilhados;
5. executar os testes pendentes descritos na spec;
6. somente depois decidir pela abertura do PR da `develop` para a `main`;
7. tratar observabilidade, repositório de infraestrutura e pipeline nas issues próprias, sem misturar esses escopos com a separação API/worker.

## Registro Histórico - 15/07/2026

Este bloco preserva o estado registrado no início da migração. O status atual acima substitui esta lista para fins de retomada.

Hoje foi revisada a configuracao de producao da instancia AWS acessada pelo alias SSH `finance-api` e foi iniciada a migracao da infraestrutura da AWS para a Oracle Cloud.

Estado ao encerrar o dia:

- a migracao AWS -> Oracle foi iniciada, mas ainda nao foi concluida;
- a instancia AWS continua sendo a referencia funcional enquanto a Oracle e preparada;
- ainda faltam o IP publico fixo/reservado da Oracle, NGINX, certificados e correcoes de DNS;
- a revisao da separacao API/worker e da arquitetura de eventos, outbox, BullMQ e notificacoes continua pendente;
- nenhuma alteracao foi feita no NGINX ou nos certificados da AWS durante a inspecao.

### Referencia Encontrada Na AWS

Configuracao ativa do NGINX na VM, fora dos containers:

```text
/etc/nginx/nginx.conf
/etc/nginx/conf.d/cloudflare-real-ip.conf
/etc/nginx/sites-available/danfy
/etc/nginx/sites-enabled/danfy -> /etc/nginx/sites-available/danfy
```

Fluxo atual de producao:

```text
Cliente -> Cloudflare -> NGINX :443 -> API Docker em 127.0.0.1:3000
```

Dados importantes para reconstruir a configuracao na Oracle:

- dominio: `api.danfy.app`;
- porta 80 redireciona para HTTPS;
- porta 443 usa HTTP/2 e TLS 1.2/1.3;
- upstream atual: `http://127.0.0.1:3000`;
- o arquivo `cloudflare-real-ip.conf` confia nos ranges IPv4 e IPv6 oficiais da Cloudflare;
- certificado Cloudflare Origin CA para `*.danfy.app` e `danfy.app`;
- validade do certificado: 19/04/2026 ate 15/04/2041;
- certificado em `/etc/nginx/ssl/cloudflare-origin.crt`, modo `644`, usuario `root`;
- chave em `/etc/nginx/ssl/cloudflare-origin.key`, modo `600`, usuario `root`;
- a chave privada nao foi lida nem copiada durante a inspecao;
- `nginx -t` passou e a API respondeu `200` pelo proxy local.

Pontos de seguranca observados na AWS:

- a porta 3000 esta publicada pelo Docker em todas as interfaces, embora o Security Group tenha bloqueado o teste externo;
- a origem respondeu diretamente pela porta 443, permitindo contornar a Cloudflare se a origem for acessada diretamente;
- nao foi encontrado Authenticated Origin Pulls/mTLS no NGINX;
- UFW esta inativo e a cadeia `DOCKER-USER` nao restringe a porta 3000;
- ao preparar a Oracle, nao repetir essas exposicoes: publicar a API somente em loopback/rede interna e restringir a origem a Cloudflare.

### Plano Registrado Em 15/07 (Histórico)

Este era o plano definido naquele dia e foi mantido como referência histórica:

1. reservar e associar um IP publico fixo na Oracle;
2. revisar Security List/NSG e liberar somente as portas realmente necessarias;
3. garantir que a API e o worker estejam funcionando na Oracle antes da troca de DNS;
4. instalar e adaptar o NGINX usando a configuracao da AWS como referencia;
5. instalar com seguranca o certificado e a chave Cloudflare Origin CA, sem coloca-los no Git;
6. configurar a Cloudflare em `Full (strict)` e considerar Authenticated Origin Pulls;
7. corrigir o DNS de `api.danfy.app` para o IP fixo da Oracle;
8. validar redirect HTTP, HTTPS, health da API, worker, outbox, BullMQ e envio de e-mail;
9. manter a AWS disponivel ate concluir os testes e definir o rollback;
10. continuar a revisao desta feature e entender completamente a arquitetura API/worker descrita abaixo.

Nao encerrar a AWS nem trocar o DNS antes de existir um teste completo e um caminho de rollback.

## Primeiro Passo Ao Voltar

Na raiz do backend:

```bash
git status
git fetch origin --prune
git log -1 --stat
git show --stat --oneline HEAD
git log --oneline origin/main..origin/develop
git diff --stat origin/main origin/develop
git show HEAD -- docs/specs/platform/api-worker-separation/specs/design.md
```

Depois leia, nesta ordem:

1. `docs/now.md` (este arquivo);
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

Root: `api/src/app/api/api.module.ts` (`ApiModule`).

Responsabilidades:

- receber HTTP;
- autenticar e validar requests;
- executar use cases;
- persistir aggregates;
- gravar eventos em `outbox_messages` na mesma transação;
- persistir intenções em `email_messages`;
- produzir jobs BullMQ quando aplicável.

A API não registra EventEmitter2, handlers de domínio, dispatcher da outbox, processor BullMQ ou `MailModule`.

### Processo Worker

Entrypoint: `api/src/worker.ts`.

Root: `api/src/app/worker/worker.module.ts`.

Responsabilidades:

- buscar mensagens da outbox;
- reidratar eventos;
- publicar eventos no EventEmitter2 local;
- executar handlers idempotentes;
- reconciliar intenções de e-mail que não entraram na fila;
- consumir BullMQ;
- enviar e-mails pelo `MailService`.

O worker usa `NestFactory.createApplicationContext`: não abre HTTP, Swagger ou controllers.

## Fluxos Entre Processos

### Evento De Domínio

```text
HTTP -> API/use case -> PostgreSQL (aggregate + outbox na mesma transacao)
-> Worker reivindica outbox -> EventEmitter2 local -> handlers
-> Worker marca outbox como PUBLISHED
```

O EventEmitter2 não comunica API e worker. A fronteira durável entre eles e a tabela `outbox_messages`.

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
2. Dentro da mesma transação, salva o novo hash, revoga sessões/tokens conforme a regra e grava `user.password.changed` na outbox.
3. A API responde sem chamar Brevo ou `MailService` diretamente.
4. O worker reivindica `user.password.changed` e o reidrata.
5. Um handler em `NotificationsEventHandlersModule` chama `CreatePasswordChangedEmailMessageUseCase`.
6. Esse use case cria uma linha idempotente em `email_messages`, por exemplo com chave `email:password-changed:user:<userId>:event:<eventId>`.
7. `EmailJobQueueProducer` adiciona `send-email-message` na fila `notifications.email`.
8. `EmailMessageProcessor` carrega a intenção e chama `SendEmailMessageUseCase`/`MailService`.
9. Em falha de Redis depois do commit, o reconciliador recupera o enqueue.

Arquivos/capacidades que provavelmente serão adicionados:

```text
users/domain/events/user-password-changed.event.ts
users/infrastructure/events/user-password-changed-event.rehydrator.ts
notifications/application/handlers/enqueue-password-changed-email.handler.ts
notifications/application/use-cases/create-password-changed-email-message/
notifications/email template e idempotency key
```

Também sera necessário:

- registrar o hydrator em `OutboxRehydratorsModule`;
- registrar o handler no modulo de handlers de notifications;
- adicionar o novo tipo/template aceito por `EmailMessage`;
- garantir idempotência no banco e no `jobId`;
- atualizar `docs/events`, `docs/notifications` e testes;
- nunca incluir senha, hash, token ou dados completos de template no evento/log.

## Organização De `src/app`

```text
api/src/app/
├── api/                 # controller e ApiModule HTTP
├── shared/              # proteção compartilhada dos entrypoints
├── worker/
│   ├── composition/     # handlers e hydrators
│   ├── health/          # health one-shot
│   ├── operations/      # heartbeat e lifecycle
│   └── worker.module.ts
└── process-composition.spec.ts
```

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
