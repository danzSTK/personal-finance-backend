---
area: platform
feature: api-worker-separation
type: spec-requirements
status: approved
related:
  - ../../../../events/README.md
  - ../../../../platform/queue-infrastructure.md
  - ../../../../platform/email-provider.md
  - ../../../../notifications/README.md
  - ../../../../auth/flows/sign-up.md
  - ../../../../auth/reference/redis-keys.md
  - ../../../../assets/flows/delete-asset.md
  - ../../../../database/schema.md
  - ../../../../deploy.md
  - ../../../platform/queue-infrastructure/specs/requirements.md
  - ../../../notifications/welcome-email/specs/requirements.md
  - ../../../auth/email-verification/specs/requirements.md
---

# Requirements - API and Worker Process Separation

## Objetivo

Separar o backend em dois processos NestJS implantáveis e escaláveis de forma independente, preservando o monólito modular, o mesmo código-fonte, o mesmo artefato de build e o mesmo PostgreSQL:

- `api`: recebe tráfego HTTP, executa casos de uso síncronos, grava dados e mensagens na outbox e produz jobs quando necessário;
- `worker`: processa a outbox, publica eventos no `EventEmitter2` local, executa handlers assíncronos e consome jobs BullMQ.

A separação deve impedir que réplicas da API executem schedulers, processors BullMQ ou consumidores de eventos. Também deve impedir que o worker exponha controllers e rotas de negócio.

## Contexto Atual

O processo HTTP atual também executa trabalho assíncrono:

- `OutboxModule` registra `ScheduleModule.forRoot()` e `OutboxProcessorService` junto do `OutboxWriteService`;
- `NotificationsModule` registra producer, handlers, persistência, `MailService` e `EmailMessageProcessor` no mesmo módulo;
- `AccountsModule`, `CategoriesModule`, `AssetsModule` e `AuthModule` registram handlers do `EventEmitter2` junto de controllers e providers HTTP;
- `BULLMQ_WORKERS_ENABLED` é carregado pela configuração, mas não controla o registro de processors;
- existe apenas `main.ts`, `AppModule`, `dist/main.js` e um serviço `api` no Docker Compose;
- o EventEmitter2 é um barramento em memória e não comunica processos diferentes;
- o resend de verificação confirma `email_messages` no PostgreSQL antes de tentar adicionar o job no BullMQ, sem reconciliador para intenções que ficarem pendentes;
- o claim da outbox permite múltiplos workers, mas as transições finais não validam o dono atual do lease.

## Princípios

- A mudança é separação de processos de um monólito modular, não extração de microserviços.
- PostgreSQL continua sendo a fonte da verdade para dados, outbox e intenções de e-mail.
- EventEmitter2 continua sendo um barramento somente dentro do processo worker.
- BullMQ continua sendo a infraestrutura de execução assíncrona e não substitui o transactional outbox.
- API e worker devem compartilhar contratos de domínio e aplicação sem duplicar regras de negócio.
- Processors, timers e handlers devem ser ativados por composição de módulos, não por condicionais espalhadas em providers.
- Todo processamento assíncrono continua at-least-once e seus consumidores devem ser idempotentes.

## Escopo

Esta spec cobre:

- criar entrypoint e root module próprios para o worker;
- manter entrypoint e root module próprios para a API;
- extrair a configuração compartilhada de PostgreSQL para composição reutilizável;
- separar escrita e processamento da outbox;
- separar producer e processor de notifications/BullMQ;
- separar handlers de eventos das composições HTTP dos módulos consumidores;
- registrar EventEmitter2, hydrators, polling e handlers somente no worker;
- garantir que a API consiga gravar outbox sem inicializar o processor;
- garantir que a API consiga produzir jobs sem inicializar processors;
- aplicar configuração e validação de ambiente por tipo de processo;
- corrigir a efetividade de concurrency e ativação dos workers;
- proteger transições da outbox com ownership do lease;
- impedir expiração silenciosa do lease durante processamento de lote;
- reconciliar intenções `email_messages` reenfileiráveis que não chegaram ao BullMQ;
- implementar inicialização e shutdown graciosos dos dois processos;
- criar comandos de desenvolvimento, build, produção e health check do worker;
- adicionar o serviço worker ao Docker Compose usando a mesma imagem da API;
- definir health, readiness, observabilidade, rollout e rollback;
- atualizar documentação de eventos, filas, notifications, deploy e variáveis de ambiente;
- adicionar testes de composição, concorrência e recuperação.

## Fora Do Escopo

Esta spec não cobre:

- extrair módulos para repositórios, bancos ou serviços independentes;
- substituir EventEmitter2 por Kafka, RabbitMQ, Redis Streams ou outro event bus distribuído;
- substituir BullMQ;
- criar novas notificações ou templates;
- alterar contratos HTTP funcionais de Accounts, Auth, Categories, Transactions, Users ou Assets;
- alterar payloads ou versões dos eventos existentes;
- garantir exactly-once para chamadas ao provider de e-mail;
- criar dashboard administrativo de BullMQ ou outbox;
- criar política de replay manual de mensagens `DEAD`;
- adicionar Kubernetes, Terraform ou service mesh;
- alterar regras financeiras ou de multi-tenancy;
- criar migrations sem uma necessidade demonstrada durante a implementação.

## Processos

### API

O processo `api` deve:

- iniciar um servidor HTTP;
- registrar controllers, guards, pipes, filters, Swagger, CORS e cookies;
- conectar ao PostgreSQL;
- conectar ao Redis de cache/sessões;
- conectar ao Redis BullMQ apenas para produzir jobs;
- gravar mensagens na outbox dentro das transações de negócio;
- não registrar polling da outbox;
- não registrar `OutboxProcessorService`;
- não registrar `EmailMessageProcessor` ou qualquer `WorkerHost`;
- não registrar handlers `@OnEvent` usados pelo processamento da outbox;
- não carregar credenciais do provider de e-mail quando não enviar e-mails diretamente.

### Worker

O processo `worker` deve:

- iniciar como application context NestJS sem servidor HTTP de negócio;
- conectar ao PostgreSQL;
- conectar ao Redis BullMQ como producer e consumer;
- conectar ao Redis de cache quando os repositories usados pelos handlers ainda forem cacheados;
- carregar Object Storage para os handlers de limpeza de avatar;
- carregar `MailService` e o provider de e-mail para jobs de notifications;
- registrar outbox processor, EventEmitter2, registry, hydrators e handlers;
- iniciar o polling da outbox somente depois que o application context concluir o bootstrap e os listeners `@OnEvent` estiverem registrados;
- registrar processors BullMQ;
- não registrar controllers, guards HTTP, Passport strategies, Swagger, CORS ou throttling HTTP;
- encerrar timers, workers BullMQ, conexões e tarefas em andamento de forma graciosa.

## Fluxos Preservados

### Escrita E Consumo De Evento

```text
Request HTTP
-> use case
-> transação PostgreSQL
-> aggregate + outbox_messages
-> commit
-> worker reivindica outbox
-> reidrata DomainEvent
-> EventEmitter2 local ao worker
-> handlers idempotentes
-> outbox PUBLISHED ou retry/DEAD
```

### Notifications

```text
API ou handler do worker
-> cria email_messages idempotente
-> producer adiciona job com jobId determinístico
-> worker BullMQ carrega emailMessageId
-> SendEmailMessageUseCase
-> MailService
-> provider
-> SENT ou falha retentável/permanente
```

### Recuperação De Enqueue

```text
email_messages PENDING ou FAILED_RETRYABLE
-> reconciliador no worker
-> adiciona job com o mesmo jobId determinístico
-> BullMQ deduplica jobs existentes
```

O enqueue imediato pode continuar existindo para reduzir latência, mas não pode ser a única forma de uma intenção persistida chegar à fila.

## Regras De Confiabilidade

- A mesma mensagem de outbox pode ser tentada novamente depois de falha, lease expirado, deploy ou morte do processo.
- Todos os handlers atuais devem continuar idempotentes sob repetição e concorrência.
- Uma transição `PROCESSING -> PUBLISHED|FAILED|DEAD` só pode ser feita pelo worker que ainda possui o lease.
- Um worker que perdeu o lease não pode sobrescrever o resultado de outro worker.
- Mensagens reivindicadas em lote não podem perder o lease apenas por aguardarem processamento dentro de um loop sequencial.
- A quantidade de mensagens simultâneas deve ser limitada por configuração.
- O worker deve parar de reivindicar novos trabalhos durante shutdown e aguardar os trabalhos em andamento até um timeout configurado.
- Depois do timeout, o processo pode encerrar; leases e jobs devem permitir recuperação por outro worker.
- `email_messages` em estado terminal não devem gerar novo envio.
- `email_messages` reenfileiráveis devem poder ser recuperadas sem criar outra intenção lógica.
- A aceitação de um e-mail pelo provider antes de persistir `SENT` continua tendo semântica at-least-once e risco residual de duplicidade.

## Regras De Configuração E Segredos

- O tipo de processo deve ser explícito e validado no bootstrap.
- O entrypoint da API deve rejeitar configuração declarada como worker e vice-versa.
- A API não deve exigir `BREVO_API_KEY` quando não carrega o provider de e-mail.
- O worker não deve exigir JWT secrets, Google OAuth secrets ou configuração CSRF que não utiliza.
- Segredos devem continuar vindo de ambiente/secret manager e nunca entrar na imagem.
- API e worker podem usar o mesmo arquivo local de ambiente, mas o contrato de produção deve permitir conjuntos de segredos distintos.
- O Redis do BullMQ deve continuar dedicado e configurado com `noeviction` e AOF.
- Host e senha do Redis BullMQ não devem usar Redis cache/sessão como fallback.
- `BULLMQ_REDIS_HOST` deve ser obrigatório para API e worker; senha BullMQ vazia ou ausente significa conexão sem autenticação.
- O prefixo BullMQ deve permanecer igual entre API e worker do mesmo ambiente.

## Regras De Erros

- A separação não introduz novo erro HTTP funcional.
- Domain errors continuam framework-independent.
- Application errors continuam pertencendo aos casos de uso.
- Erros de worker não devem ser convertidos em resposta HTTP.
- Erros retentáveis devem ser propagados ao outbox/BullMQ para acionar retry.
- Erros permanentes devem resultar em estado terminal conhecido sem loop infinito.
- Erros desconhecidos devem ser logados com contexto operacional e sem secrets, tokens, payload completo de e-mail, stack trace em storage público ou SQL bruto.
- Falha de configuração no bootstrap deve encerrar o processo com exit code diferente de zero.

## Regras De Observabilidade

- Todo log de worker deve identificar `processRole=worker` e `workerInstanceId`.
- Logs de outbox devem incluir `outboxMessageId`, `eventName`, `attempt`, `lockedBy` e resultado.
- Logs BullMQ devem incluir queue, job name, job id, attempt e resultado.
- Não logar token de verificação, template params completos, recipient email completo ou credenciais.
- Devem existir sinais para backlog e falhas: mensagens outbox prontas/processing/dead, jobs BullMQ waiting/active/failed e `email_messages` reenfileiráveis antigos.
- A documentação deve definir consultas ou comandos operacionais mínimos para diagnóstico.

## Requisitos Funcionais

### REQ-001 - Iniciar API sem consumidores

WHEN o entrypoint da API iniciar
THE SYSTEM SHALL registrar o servidor HTTP e providers síncronos sem registrar polling da outbox, handlers de eventos ou processors BullMQ.

### REQ-002 - Iniciar worker sem API de negócio

WHEN o entrypoint do worker iniciar
THE SYSTEM SHALL registrar os consumidores assíncronos sem abrir rotas HTTP de negócio.

### REQ-003 - Compartilhar artefato

WHEN a aplicação for compilada
THE SYSTEM SHALL produzir `dist/main.js` e `dist/worker.js` a partir do mesmo código e da mesma imagem Docker.

### REQ-004 - Preservar escrita transacional da outbox

WHEN um use case da API persistir um aggregate e seus eventos
THE SYSTEM SHALL gravar os eventos com o mesmo `EntityManager` sem depender da presença do outbox processor no processo API.

### REQ-005 - Processar outbox apenas no worker

WHEN houver mensagens prontas na outbox
THE SYSTEM SHALL permitir que somente processos worker as reivindiquem e publiquem.

### REQ-006 - Manter EventEmitter2 local

WHEN o worker reidratar uma mensagem de outbox
THE SYSTEM SHALL publicar o evento no EventEmitter2 da mesma instância worker.

### REQ-007 - Registrar todos os consumidores atuais

WHEN o worker iniciar
THE SYSTEM SHALL registrar os consumidores atuais de Accounts, Categories, Assets, Auth e Notifications para os eventos documentados.

### REQ-008 - Produzir jobs sem consumir na API

WHEN a API precisar enfileirar um e-mail
THE SYSTEM SHALL usar o producer BullMQ sem instanciar `EmailMessageProcessor`.

### REQ-009 - Consumir jobs somente no worker

WHEN o worker iniciar
THE SYSTEM SHALL registrar `EmailMessageProcessor` com concurrency efetiva vinda da configuração aprovada.

### REQ-010 - Reconciliar intenções não enfileiradas

WHEN existir `email_messages` reenfileirável sem execução terminal
THE SYSTEM SHALL reenfileirar a intenção usando o mesmo `jobId` determinístico sem criar outra linha.

### REQ-011 - Proteger ownership do lease

WHEN um worker finalizar uma tentativa de outbox
THE SYSTEM SHALL atualizar a mensagem somente se `status=PROCESSING` e `lockedBy` ainda pertencer àquela tentativa/instância.

### REQ-012 - Evitar expiração por espera no lote

WHEN um lote de outbox for processado
THE SYSTEM SHALL limitar o lote à capacidade disponível e renovar leases ou usar estratégia equivalente que impeça expiração silenciosa antes do início/fim do handler.

### REQ-013 - Permitir múltiplas instâncias worker

WHEN duas ou mais instâncias worker executarem simultaneamente
THE SYSTEM SHALL usar `FOR UPDATE SKIP LOCKED` e ownership do lease para impedir conclusão concorrente válida da mesma tentativa.

### REQ-014 - Aplicar configuração por processo

WHEN API ou worker carregar ambiente
THE SYSTEM SHALL validar somente as configurações exigidas por suas capacidades e falhar claramente quando uma dependência obrigatória estiver ausente.

### REQ-015 - Encerrar graciosamente

WHEN API ou worker receber `SIGTERM` ou `SIGINT`
THE SYSTEM SHALL parar de aceitar/reivindicar novo trabalho, aguardar trabalho em andamento dentro do timeout e fechar recursos NestJS.

### REQ-016 - Implantar worker no Compose

WHEN o ambiente Docker Compose subir
THE SYSTEM SHALL iniciar serviços `api` e `worker` com comandos diferentes sobre a mesma imagem e sem publicar porta de negócio do worker.

### REQ-017 - Verificar saúde do worker

WHEN o health check operacional do worker executar
THE SYSTEM SHALL verificar processo/heartbeat e conectividade necessária com PostgreSQL e Redis BullMQ, além do Redis de cache enquanto ele for dependência dos handlers.

### REQ-018 - Preservar contratos HTTP

WHEN a separação for concluída
THE SYSTEM SHALL preservar endpoints, response DTOs, cookies e códigos de erro HTTP existentes.

## Requisitos Não Funcionais

### Isolamento

- Escalar a API não deve aumentar o número de consumidores de outbox ou jobs.
- Escalar o worker não deve abrir novos endpoints públicos.
- Falha do worker não deve impedir a API de responder leituras e escritas que não precisem produzir job imediatamente.

### Confiabilidade

- Nenhum evento confirmado no PostgreSQL pode depender de emissão em memória na API.
- Reinício do worker deve recuperar mensagens e jobs não terminados.
- Enqueue falho depois de commit deve ser recuperável pelo reconciliador.

### Performance

- O polling da outbox deve ser configurável e não executar ciclos sobrepostos na mesma instância.
- O primeiro claim da outbox não pode ocorrer durante `onModuleInit` nem antes da prontidão do EventEmitter2.
- Batch, lease, concurrency e shutdown timeout devem ter limites positivos validados.
- Nenhum índice novo deve ser criado sem análise da query e evidência por `EXPLAIN (ANALYZE, BUFFERS)` em volume representativo.

### Segurança

- O worker não recebe tráfego externo de usuário.
- API e worker recebem apenas os secrets necessários ao próprio processo em produção.
- Payloads de jobs continuam mínimos e sem secrets.
- Dados multi-tenant continuam resolvidos/validados por `userId` persistido no evento ou recurso, nunca por entrada HTTP no worker.

### Operabilidade

- API e worker devem ter logs distinguíveis.
- Deploy e rollback devem permitir uma janela curta de sobreposição sem corrupção, apoiados por idempotência e leases.
- O runbook deve explicar como identificar backlog, mensagens `DEAD`, jobs falhos e intenções de e-mail pendentes.

## Edge Cases

- IF a API iniciar sem o worker disponível
  THEN requests continuam gravando outbox e o backlog deve ser processado quando o worker voltar.

- IF o Redis BullMQ estiver indisponível durante um resend
  THEN a intenção persistida deve permanecer reenfileirável e ser recuperada pelo reconciliador.

- IF o worker morrer depois de reivindicar uma mensagem
  THEN outro worker deve recuperá-la após expiração do lease.

- IF um worker antigo terminar depois de perder o lease
  THEN sua atualização final deve ser rejeitada por ownership.

- IF um handler tiver sucesso e outro falhar no mesmo evento
  THEN a mensagem deve entrar em retry e handlers já executados devem suportar repetição.

- IF o provider aceitar o e-mail e o processo morrer antes de marcar `SENT`
  THEN o sistema pode repetir o envio; o risco at-least-once deve permanecer documentado e observável.

- IF o worker iniciar sem um hydrator necessário
  THEN o bootstrap deve falhar por validação do catálogo esperado ou a mensagem deve falhar de forma diagnosticável sem ser marcada como publicada.

- IF o worker iniciar com mensagens pendentes na outbox
  THEN nenhum claim deve ocorrer antes do registro completo dos listeners `@OnEvent` e nenhum evento sem listener pode ser marcado como publicado.

- IF `BULLMQ_REDIS_PASSWORD` estiver ausente ou vazio
  THEN API e worker devem conectar ao Redis BullMQ sem autenticação, sem reutilizar `REDIS_PASSWORD`.

- IF API e worker usarem prefixos BullMQ diferentes
  THEN o bootstrap/health check deve evidenciar a divergência antes de considerar o ambiente pronto.

- IF o worker receber SIGTERM durante job ou handler
  THEN deve aguardar até o timeout e deixar o trabalho recuperável se não concluir.

- IF não houver mensagens ou jobs
  THEN o worker deve permanecer saudável sem busy loop.

- IF o reconciliador encontrar mensagem terminal
  THEN não deve enfileirar novo job.

- IF duas execuções do reconciliador encontrarem a mesma intenção
  THEN o `jobId` determinístico e o estado persistido devem impedir uma nova intenção lógica.

## Critérios De Aceite

- Existem `requirements.md`, `design.md`, `tasks.md` e `decisions.md` aprovados antes da implementação.
- `npm run build` gera os dois entrypoints.
- A API sobe e responde health/E2E sem instanciar outbox processor ou processors BullMQ.
- O worker sobe sem controllers/rotas de negócio e registra todos os handlers, hydrators e processors esperados.
- `BULLMQ_WORKERS_ENABLED` deixa de ser uma configuração inefetiva; a composição explícita passa a ser a fonte de verdade.
- Outbox writer funciona na API sem timer ou processor de polling.
- Outbox dispatcher funciona no worker e valida ownership nas transições finais.
- Outbox dispatcher inicia somente após o bootstrap completo e rejeita publicação sem listeners.
- Configuração BullMQ dedicada falha no bootstrap sem host próprio e nunca herda credenciais do Redis de cache.
- Teste concorrente comprova que duas instâncias não concluem validamente a mesma tentativa.
- Teste de lease expirado comprova que worker antigo não sobrescreve o novo dono.
- Teste de falha de enqueue comprova recuperação de `email_messages` pelo reconciliador.
- Teste de composição comprova que `EmailMessageProcessor` não existe na API e existe no worker.
- API e worker encerram com shutdown gracioso.
- Docker Compose possui serviços separados usando a mesma imagem.
- Worker não publica porta externa de negócio.
- Documentação de eventos deixa de marcar consumidores implementados como planejados.
- `docs/deploy.md`, `.env.exemple` e documentação de filas descrevem comandos, dependências, health, rollout e rollback.
- Nenhuma migration é criada se o desenho final continuar usando as colunas e índices atuais.
