---
area: platform
feature: api-worker-separation
type: spec-decisions
status: approved
related:
  - ./requirements.md
  - ./design.md
---

# Decisions - API and Worker Process Separation

## DEC-001 - Permanecer como monólito modular com dois processos

Status: accepted

Decision:
Manter um único código-fonte, package, domínio, banco e pipeline de build, criando composition roots separadas para API e worker.

Reason:
O problema atual é acoplamento de runtime entre HTTP, scheduler e processors, não necessidade de autonomia de dados/equipe típica de microserviços. Separar processos entrega escalabilidade e isolamento operacional sem introduzir comunicação distribuída adicional.

Alternatives:

- Extrair notifications/outbox como microserviço: rejeitado pelo custo operacional, compartilhamento atual de use cases/repositories e ausência de requisito de banco independente.
- Manter um processo com flag: rejeitado porque imports indiretos e flags inefetivas já demonstraram fragilidade.

Impact:
API e worker são implantáveis separadamente, mas continuam versionados e liberados juntos.

## DEC-002 - Usar entrypoints e root modules explícitos

Status: accepted

Decision:
Usar `main.ts + ApiModule` para API e `worker.ts + WorkerModule` para worker.

Reason:
O grafo de providers deve determinar capacidades ativas. Um role explícito no bootstrap torna impossível iniciar processors por simples escala da API quando testes de composição estiverem presentes.

Impact:
Build, scripts, Docker e CI precisam validar os dois entrypoints.

## DEC-003 - Usar a mesma imagem Docker com commands diferentes

Status: accepted

Decision:
Construir uma única imagem imutável contendo API, worker e health command; Compose/deploy escolhe o command.

Reason:
Evita drift de versão entre contratos de evento, hydrators, handlers e entidades. Também reduz duplicação de Dockerfile e pipeline.

Alternatives:

- Imagens separadas: possível no futuro se tamanho ou segurança exigirem, mas adiciona coordenação de versões agora.

Impact:
Segredos continuam injetados por serviço, não embutidos na imagem.

## DEC-004 - EventEmitter2 permanece local ao worker

Status: accepted

Decision:
A API nunca dependerá de emissão EventEmitter2 para comunicar com o worker. O worker reivindica a outbox e só então publica no EventEmitter2 da própria instância.

Reason:
EventEmitter2 é memória local e não atravessa processos. O PostgreSQL outbox já é o limite durável adequado.

Alternatives:

- Trocar por event bus distribuído: fora de escopo e sem requisito atual de throughput/autonomia que justifique a complexidade.

Impact:
`AppEventsModule`, registry, hydrators e handlers pertencem somente ao worker.

## DEC-005 - Separar módulos por capacidade

Status: accepted

Decision:
Separar persistence/core, HTTP, event handlers, producer e processor em módulos NestJS distintos, evitando importar facades HTTP no WorkerModule.

Reason:
Hoje modules misturam controllers e consumers. Apenas criar `worker.ts` manteria providers desnecessários, secrets amplos e risco de exposição acidental de rotas.

Alternatives:

- Importar modules atuais no application context: funcionaria sem `listen`, mas preservaria acoplamento e impediria configuração/segredos mínimos.
- Providers condicionais dentro dos modules atuais: torna o grafo difícil de testar e mantém duas fontes de verdade.

Impact:
Haverá refatoração de wiring em Accounts, Assets, Auth, Categories, Notifications e Users, sem mover regras de domínio.

## DEC-006 - Separar writer e dispatcher da outbox

Status: accepted

Decision:
Criar módulos distintos para persistence, writer e dispatcher. O writer não importa ScheduleModule, EventEmitter2, registry ou processor.

Reason:
A API precisa gravar eventos, mas não deve processá-los. O módulo único atual ativa ambos por efeito colateral.

Impact:
Use cases continuam injetando `OutboxWriteService`; somente imports de composição mudam.

## DEC-007 - Remover BULLMQ_WORKERS_ENABLED

Status: accepted

Decision:
Remover `BULLMQ_WORKERS_ENABLED` e usar o root module/entrypoint como fonte de verdade para registrar processors.

Reason:
O flag atual é carregado, mas não usado. Mesmo implementado, continuaria duplicando a responsabilidade já expressa pelo processo escolhido.

Alternatives:

- Corrigir o flag e manter um root module: rejeitado porque configuração condicional de providers é menos verificável que composition roots explícitas.

Impact:
`.env.exemple`, Joi, queue config, docs e deploy devem ser atualizados. `PROCESS_ROLE` valida o entrypoint, mas não liga/desliga providers dentro dele.

## DEC-008 - Worker combinado inicialmente

Status: accepted

Decision:
O primeiro `WorkerModule` executará outbox dispatcher, event handlers, reconciliador e email processor no mesmo processo, mantendo módulos internos separados.

Reason:
Um único worker reduz custo operacional inicial. A separação interna permite criar no futuro `outbox-worker` e `email-worker` sem refazer bounded contexts.

Alternatives:

- Dois workers desde o início: melhora isolamento de recursos, mas aumenta deploy, health, configuração e capacidade mínima antes de existir evidência de necessidade.

Impact:
O worker combinado precisa da união de PostgreSQL, ambos Redis, Object Storage e Mail provider.

## DEC-009 - Validar configuração e secrets por processo

Status: accepted

Decision:
Criar configuração role-aware para que API e worker validem e recebam somente dependências necessárias. `PROCESS_ROLE` deve coincidir com o entrypoint.

Reason:
O schema Joi atual exige JWT, Google OAuth, R2, mail e BullMQ para qualquer processo. Isso aumenta blast radius e impede deploy realmente independente.

Impact:
ConfigModule se torna dynamic/role-aware e ganha testes de contratos API/worker.

## DEC-010 - API continua producer BullMQ

Status: accepted

Decision:
A API poderá adicionar jobs imediatamente, mas nunca registrará processors. A intenção persistida e o reconciliador serão a garantia de recuperação.

Reason:
Preserva baixa latência do resend e o port atual `EmailJobQueueProducer`, enquanto remove a dependência do enqueue imediato como única garantia.

Alternatives:

- API nunca conectar ao BullMQ e worker sempre varrer `email_messages`: reduz dependências da API, mas introduz latência de polling em todo e-mail e muda o fluxo aprovado de queue producer.
- Criar outro tipo de outbox para comandos BullMQ: oferece atomicidade genérica, mas amplia schema e abstração sem necessidade para o único fluxo atual.

Impact:
Redis BullMQ continua dependência do producer da API, mas falha depois do commit deixa estado recuperável.

## DEC-011 - Reconciliar email_messages reenfileiráveis

Status: accepted

Decision:
Adicionar scheduler no worker para reenfileirar `PENDING` e `FAILED_RETRYABLE` antigos usando jobId determinístico.

Reason:
Resolve a janela PostgreSQL commit -> Queue.add, especialmente no resend sujeito a cooldown.

Alternatives:

- Confiar em retry HTTP/outbox: insuficiente para resend e indisponibilidade prolongada de Redis.
- Transação distribuída PostgreSQL/Redis: indisponível e inadequada.

Impact:
Reutiliza `email_messages` e o índice `(status, created_at)` sem migration inicial.

## DEC-012 - Fortalecer lease da outbox sem coluna nova

Status: accepted

Decision:
Usar `locked_by` como ownership/fencing nas transições finais, renovar leases ativos e limitar claims à capacidade disponível.

Reason:
O batch atual pode expirar antes de chegar ao fim do loop e updates por id permitem que worker antigo sobrescreva o novo dono. As colunas existentes suportam uma correção sem schema novo.

Alternatives:

- Adicionar `claim_token`/versão de lease: fencing mais forte, mas exige migration; pode ser reavaliado se testes mostrarem ambiguidade não coberta por instance id único.
- Processar sempre uma mensagem: simples e seguro, mas limita throughput desnecessariamente.

Impact:
Repository ganha updates condicionais e lease renewal. Testes precisam usar PostgreSQL real.

## DEC-013 - Não criar migration inicialmente

Status: accepted

Decision:
Reutilizar schema e índices atuais de `outbox_messages` e `email_messages`.

Reason:
O objetivo é composição/processamento. `locked_by`, `locked_until`, status e índices atuais atendem o desenho inicial. Índice novo sem plano/volume seria especulativo.

Impact:
Qualquer necessidade de schema descoberta por implementação ou EXPLAIN exige atualização prévia da spec, migration incremental e atualização de `docs/database/schema.md`.

## DEC-014 - Manter semântica at-least-once

Status: accepted

Decision:
Documentar explicitamente que outbox, handlers, BullMQ e envio externo operam at-least-once.

Reason:
Idempotency key e jobId impedem duplicação lógica interna, mas não eliminam a janela entre provider aceitar e PostgreSQL persistir `SENT`.

Alternatives:

- Prometer exactly-once: tecnicamente incorreto sem idempotência transacional do provider.

Impact:
Handlers permanecem idempotentes; risco de duplicidade externa fica observável e pode virar spec própria.

## DEC-015 - Worker usa application context sem HTTP de negócio

Status: accepted

Decision:
Iniciar o worker com `NestFactory.createApplicationContext` e health check one-shot/heartbeat, sem servidor HTTP.

Reason:
Reduz superfície de ataque e impede exposição acidental de controllers. Health operacional não exige manter outro HTTP adapter.

Alternatives:

- Servidor HTTP interno de health: simples para orquestradores, mas qualquer import incorreto de controller poderia expor rotas no mesmo adapter.

Impact:
Docker healthcheck chama um comando dedicado que não inicializa processors.

## DEC-016 - Rollout inicia worker antes de retirar consumers da API

Status: accepted

Decision:
Durante a migração, iniciar e validar o worker novo antes de substituir a API antiga pela composition root sem consumers.

Reason:
Evita intervalo sem processamento. Uma sobreposição curta é mais segura porque o desenho suporta SKIP LOCKED, ownership e idempotência.

Impact:
Runbook precisa monitorar claims, jobs e backlog durante rollout. Rollback preserva banco e Redis.

## DEC-017 - API readiness não cai automaticamente com BullMQ

Status: accepted

Decision:
Reportar falha de BullMQ como dependência degradada da API, sem tornar toda a API unready por padrão, desde que a operação persista uma intenção recuperável antes do enqueue.

Reason:
Leituras e comandos não relacionados à fila podem continuar disponíveis. O reconciliador recupera intenções persistidas depois que Redis volta.

Alternatives:

- Tornar API unready com BullMQ indisponível: reduz respostas parcialmente degradadas, mas derruba toda a API por falha de uma capacidade assíncrona.

Impact:
Fluxos que ainda não persistirem intenção recuperável devem falhar explicitamente; health e runbook precisam distinguir ready de degraded.

## DEC-018 - Não alterar contratos HTTP nesta refatoração

Status: accepted

Decision:
Preservar endpoints, DTOs, cookies, status e error codes atuais.

Reason:
A mudança é operacional/arquitetural. Misturar alteração de frontend aumentaria o risco e dificultaria rollback.

Impact:
Novos erros são internos ao worker/configuração e não entram no `AppExceptionFilter`, salvo se uma implementação revelar impacto HTTP e atualizar a spec primeiro.

## DEC-019 - Extrair persistência de Users do core HTTP

Status: accepted

Decision:
Criar `UsersPersistenceModule` com repository/cache e fazer Notifications depender desse módulo, mantendo avatar, Sharp, upload, Assets e Outbox em `UsersCoreModule`.

Reason:
Os handlers de e-mail precisam apenas consultar usuário. Importar o core completo no worker ampliava o grafo e carregava capacidades HTTP/storage sem uso.

Impact:
API continua usando `UsersCoreModule`; worker de notifications reutiliza somente o binding de `IUserRepository`. Assets continua explícito no worker exclusivamente pelos handlers de limpeza de avatar.

## Registro De Implementação

- Clientes Redis próprios fecham em `onApplicationShutdown`, depois que heartbeat e serviços em draining executam `beforeApplicationShutdown`.
- `API_ENV_FILE` e `WORKER_ENV_FILE` permitem contratos de secrets distintos no Compose, com fallback para `.env` local.
- O smoke de container encontrou um export ausente de Accounts; `AccountsCoreModule` passou a exportar `UnarchiveAccountUseCase` e `UpdateAccountUseCase`, com teste de composição para evitar regressão.
- O alias `@/` foi adicionado ao resolver Jest E2E para que a validação de bootstrap existente consiga executar.

## DEC-020 - Organizar app por composition root

Status: accepted

Decision:
Separar fisicamente `api/src/app/api`, `api/src/app/worker` e `api/src/app/shared`, renomeando `AppModule` para `ApiModule`.

Reason:
Depois da separação de processos, arquivos HTTP, health, heartbeat e composição de consumers ficaram misturados no mesmo nível de `app`, tornando ownership e imports ambíguos.

Impact:
Somente paths, nomes de classes da root HTTP e documentação mudam. O `AppService` vazio e sem consumidores é removido. Entry points compilados, endpoints, módulos de domínio, filas, eventos e contratos permanecem iguais.

## DEC-021 - Isolar testes reais em uma suíte de integração com containers

Status: accepted

Decision:
Executar testes PostgreSQL, Redis, BullMQ e falhas de rede em `npm run test:integration`, usando Testcontainers e Toxiproxy, separados de `npm test`.

Reason:
Mocks não validam `FOR UPDATE SKIP LOCKED`, ownership de lease, TTL Redis, deduplicação BullMQ, múltiplos workers ou recuperação de conexões. Ao mesmo tempo, exigir Docker em toda execução unitária reduziria a velocidade e dificultaria desenvolvimento local.

Impact:
A suíte de integração exige Docker e roda em série. Ela compila os entrypoints antes dos testes, executa migrations em banco efêmero e não acessa PostgreSQL, Redis, filas ou provedores externos do ambiente do desenvolvedor.

Durante os testes de indisponibilidade, o Redis de cache revelou que uma operação de health podia aguardar indefinidamente. O health do worker passou a verificar PostgreSQL, Redis de cache e Redis BullMQ em paralelo, com timeout interno de 2 segundos por dependência.

## DEC-022 - Iniciar outbox depois do bootstrap completo

Status: accepted

Decision:
Remover o start do polling de `onModuleInit`. O entrypoint do worker inicia explicitamente o `OutboxProcessorService` somente depois que `createApplicationContext` concluir e o `EventEmitterReadinessWatcher` confirmar o registro dos listeners.

Reason:
O loader de `@OnEvent` registra subscribers em `onApplicationBootstrap`. Um claim iniciado em `onModuleInit` pode emitir sem listeners; EventEmitter2 trata isso como sucesso vazio e permitiria marcar a mensagem como `PUBLISHED` sem executar efeitos.

Impact:
O start é idempotente, publicação sem listeners falha de forma retentável e o log de worker pronto ocorre apenas depois da ativação do processor. Um teste deve iniciar o worker com outbox pendente.

## DEC-023 - BullMQ não reutiliza configuração do Redis de cache

Status: accepted

Decision:
Remover fallbacks `BULLMQ_REDIS_* -> REDIS_*`. O host BullMQ é obrigatório, a porta possui default próprio e senha vazia/ausente significa sem autenticação.

Reason:
O Redis BullMQ é uma dependência dedicada com AOF e `noeviction`. Fallback silencioso pode conectar filas ao Redis de cache ou autenticar no Redis BullMQ sem senha usando a senha do cache.

Impact:
API e worker falham cedo sem `BULLMQ_REDIS_HOST`. Compose repassa a mesma senha BullMQ aos três containers envolvidos. PostgreSQL permanece externo no RDS e continua configurado pelo `env_file`.
