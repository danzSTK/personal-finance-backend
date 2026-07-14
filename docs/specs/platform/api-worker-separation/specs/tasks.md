---
area: platform
feature: api-worker-separation
type: spec-tasks
status: approved
related:
  - ./requirements.md
  - ./design.md
  - ./decisions.md
---

# Tasks - API and Worker Process Separation

## Aprovação

- [x] 1. Revisar e aprovar `requirements.md`.
- [x] 2. Revisar e aprovar `design.md`.
- [x] 3. Revisar e aprovar esta lista de tasks.
- [x] 4. Confirmar as decisões propostas em `decisions.md` ou registrar ajustes.

## Baseline

- [ ] 5. Registrar baseline de `npm run build`, testes e lint antes da refatoração.
- [ ] 6. Criar teste de composição que demonstre que o processo atual registra outbox processor e email processor junto da API.
- [x] 7. Inventariar todos os controllers, handlers `@OnEvent`, hydrators, schedulers e processors que precisam ser atribuídos a um único role.
- [x] 8. Inventariar os providers/repositories exportados entre Auth, Users, Accounts, Categories, Assets e Notifications para evitar bindings duplicados.

## Tipos E Configuração

- [x] 9. Criar contrato TypeScript `ProcessRole` com const object e type derivado.
- [x] 10. Refatorar configuração para composition roots API/worker com schemas Joi específicos.
- [x] 11. Validar que `PROCESS_ROLE=api` só inicia o entrypoint API.
- [x] 12. Validar que `PROCESS_ROLE=worker` só inicia o entrypoint worker.
- [x] 13. Adicionar e validar configurações de polling, batch, concurrency, lease e renewal da outbox.
- [x] 14. Adicionar e validar configurações de shutdown e heartbeat do worker.
- [x] 15. Adicionar e validar configurações do reconciliador de e-mail.
- [x] 16. Remover `BULLMQ_WORKERS_ENABLED` do schema Joi, queue config, constants e testes.
- [x] 17. Garantir que API não exija mail/Brevo secrets.
- [x] 18. Garantir que worker não exija JWT, Google OAuth, CSRF ou throttle HTTP.
- [x] 19. Adicionar testes unitários dos schemas e invariantes cruzados de configuração.

## PostgreSQL Compartilhado

- [x] 20. Extrair `TypeOrmModule.forRootAsync` para `PostgresModule` compartilhado pelas duas roots.
- [x] 21. Preservar `ENTITIES`, `synchronize=false`, SSL e logging conforme ambiente.
- [x] 22. Atualizar `AppModule` para usar `PostgresModule`.
- [ ] 23. Criar teste de wiring do `PostgresModule` sem conexão real.

## Outbox Modules

- [x] 24. Criar `OutboxPersistenceModule` sem scheduler/event bus.
- [x] 25. Criar `OutboxWriterModule` com `OutboxWriteService` e exports necessários.
- [x] 26. Criar `OutboxDispatcherModule` com scheduler, registry e processor.
- [x] 27. Atualizar use cases produtores para importar/injetar writer sem mudar comportamento transacional.
- [x] 28. Mover `OutboxRehydratorsModule` para composição exclusiva do worker.
- [x] 29. Remover o módulo monolítico antigo ou transformá-lo em facade temporária sem ativação implícita.
- [x] 30. Testar que importar writer não instancia ScheduleModule, EventRegistry ou processor.

## Outbox Lease E Concorrência

- [x] 31. Alterar `markPublished` para exigir `lockedBy` e status `PROCESSING`.
- [x] 32. Alterar `markFailed` para exigir `lockedBy` e status `PROCESSING`.
- [x] 33. Implementar `extendLease` condicionado ao owner atual.
- [x] 34. Tratar zero linhas afetadas como lease perdido sem sobrescrever estado.
- [x] 35. Refatorar processor para reivindicar somente capacidade disponível.
- [x] 36. Aplicar concurrency configurável e limitada no processamento do lote.
- [x] 37. Implementar renovação periódica de lease para mensagens ativas.
- [x] 38. Impedir ciclos de polling sobrepostos na mesma instância.
- [x] 39. Impedir novos claims quando o worker estiver draining.
- [x] 40. Adicionar testes unitários de lease renewal, lease perdido, retry e shutdown.
- [ ] 41. Adicionar testes PostgreSQL concorrentes para `SKIP LOCKED` com duas instâncias.
- [ ] 42. Testar recuperação de lock expirado.
- [ ] 43. Testar que worker stale não marca `PUBLISHED`, `FAILED` ou `DEAD` após perder ownership.
- [ ] 44. Executar `EXPLAIN (ANALYZE, BUFFERS)` do claim com dados representativos e registrar resultado na implementação/PR.
- [ ] 45. Atualizar a spec antes de criar qualquer índice ou migration descoberto pelo EXPLAIN.

## Módulos Por Capacidade

- [x] 46. Separar core/HTTP/event handlers de Accounts sem duplicar repository bindings.
- [x] 47. Mover `ProvisionDefaultAccountOnUserHandler` para módulo exclusivo de handlers.
- [x] 48. Separar core/HTTP/event handlers de Categories.
- [x] 49. Mover `ProvisionDefaultCategoriesOnUserHandler` para módulo exclusivo de handlers.
- [x] 50. Separar core/event handlers de Assets.
- [x] 51. Mover handlers de avatar para módulo exclusivo e preservar Object Storage explícito.
- [x] 52. Separar persistence/read providers de Users das capacidades HTTP de avatar.
- [x] 53. Preservar `UsersEventsModule` como fornecedor de hydrators sem importar outbox dispatcher.
- [x] 54. Separar core HTTP de Auth das capacidades usadas pelo handler de verificação.
- [x] 55. Mover `EnqueueEmailVerificationOnUserCreatedHandler` para `AuthEventHandlersModule`.
- [x] 56. Garantir que módulos worker não importem controllers, Passport/JWT strategies ou throttling HTTP.
- [x] 57. Criar `WorkerEventConsumersModule` como composição explícita de todos os handlers atuais.
- [ ] 58. Adicionar teste que compara o catálogo esperado de handlers/hydrators com providers registrados no worker.

## Notifications

- [x] 59. Criar `NotificationsPersistenceModule` para `email_messages` e repository binding.
- [x] 60. Criar `NotificationsProducerModule` com queue, producer e use cases de criação de intenção.
- [x] 61. Criar `NotificationsEventHandlersModule` sem processor BullMQ.
- [x] 62. Criar `NotificationsWorkerModule` com `MailModule`, send use case e `EmailMessageProcessor`.
- [x] 63. Garantir que API importe producer, mas não MailModule/processor.
- [x] 64. Garantir que worker registre producer e processor.
- [x] 65. Aplicar `BULLMQ_DEFAULT_CONCURRENCY` de forma efetiva no worker.
- [x] 66. Adicionar teste de composição garantindo processor ausente na API e presente no worker.
- [x] 67. Atualizar testes existentes de notifications para os novos módulos sem alterar regra de negócio.

## Reconciliador De Enqueue

- [x] 68. Adicionar contrato de repository para listar `email_messages` reenfileiráveis por status/idade/lote.
- [x] 69. Implementar query alinhada a `idx_email_messages_status_created_at` com colunas explícitas.
- [x] 70. Criar serviço reconciliador exclusivo do worker.
- [x] 71. Reenfileirar com `EmailJobQueueProducer` e jobId determinístico existente.
- [x] 72. Garantir que estados terminais não sejam selecionados/enfileirados.
- [x] 73. Garantir que falha de queue não altere a intenção para estado incorreto.
- [ ] 74. Testar duas instâncias reconciliando a mesma intenção.
- [ ] 75. Testar recuperação do gap commit PostgreSQL -> falha em `Queue.add` no resend.
- [ ] 76. Testar recuperação do mesmo gap em handler disparado pela outbox.
- [ ] 77. Executar `EXPLAIN (ANALYZE, BUFFERS)` da query de reconciliação com dados representativos.
- [ ] 78. Atualizar a spec antes de alterar schema/índice por necessidade do reconciliador.

## Composition Roots E Bootstraps

- [x] 79. Refatorar `AppModule` para conter somente capacidades da API.
- [x] 80. Criar `WorkerModule` sem controllers/rotas de negócio.
- [x] 81. Criar `worker.ts` com `NestFactory.createApplicationContext`.
- [x] 82. Habilitar shutdown hooks na API.
- [x] 83. Habilitar shutdown hooks no worker.
- [x] 84. Implementar estado draining e timeout de shutdown do worker.
- [x] 85. Garantir fechamento de scheduler, BullMQ workers, application context e conexões.
- [x] 86. Adicionar logs de startup com role, instance id e capacidades sem secrets.
- [ ] 87. Adicionar testes de bootstrap para role mismatch e falha de configuração.
- [ ] 88. Adicionar smoke test de WorkerModule sem HTTP adapter.

## Health E Observabilidade

- [x] 89. Implementar `WorkerHeartbeatService` com instance id e TTL.
- [x] 90. Criar entrypoint/comando one-shot de health que não registra consumers.
- [x] 91. Verificar heartbeat, PostgreSQL, Redis BullMQ e Redis cache no health worker.
- [x] 92. Definir saída/exit codes estáveis para o health command.
- [x] 93. Adicionar contexto estruturado aos logs de outbox e BullMQ.
- [x] 94. Mascarar PII e impedir logs de token/template params/secrets.
- [x] 95. Documentar métricas/consultas mínimas para backlog, `DEAD`, failed jobs e e-mails reenfileiráveis antigos.
- [x] 96. Testar heartbeat expirado, dependência indisponível e health saudável.

## Build E Scripts

- [x] 97. Configurar build para gerar `dist/main.js`, `dist/worker.js` e health command.
- [x] 98. Adicionar `start:worker:dev`.
- [x] 99. Adicionar `start:worker:prod`.
- [x] 100. Adicionar `health:worker`.
- [ ] 101. Verificar watch mode simultâneo da API e worker em desenvolvimento.
- [ ] 102. Adicionar teste/CI que falha se qualquer entrypoint deixar de compilar.

## Docker E Deploy

- [x] 103. Atualizar Dockerfile para executar como usuário não root.
- [x] 104. Garantir que a imagem única contenha os três entrypoints compilados.
- [x] 105. Adicionar serviço `worker` ao Docker Compose sem porta publicada.
- [x] 106. Configurar commands e `PROCESS_ROLE` distintos para API e worker.
- [x] 107. Configurar secrets/env mínimos por serviço no contrato de produção.
- [x] 108. Adicionar healthcheck do worker ao Compose.
- [x] 109. Preservar Redis BullMQ dedicado com AOF e `noeviction`.
- [x] 110. Definir limites de CPU/memória e restart policy para o worker.
- [x] 111. Validar `docker compose config`.
- [ ] 112. Subir Compose e executar smoke test API -> outbox -> handlers -> BullMQ -> email noop.
- [x] 113. Testar SIGTERM e shutdown gracioso no container worker.
- [x] 114. Documentar rollout com sobreposição curta e rollback sem remoção de volumes.

## Documentação

- [x] 115. Atualizar `docs/events/README.md` com limites de processo e consumidores atuais.
- [x] 116. Atualizar `docs/events/add-event.md` com registro no worker composition.
- [x] 117. Atualizar `docs/events/user-created.md` removendo status planejado de consumers já implementados.
- [ ] 118. Atualizar `docs/events/events-map.canvas` sem sobrescrever alterações existentes do usuário.
- [x] 119. Atualizar `docs/platform/queue-infrastructure.md` removendo o flag inefetivo e explicando producer/worker.
- [x] 120. Atualizar `docs/notifications/README.md` com módulos/processos.
- [x] 121. Atualizar docs de auth/email verification com recuperação do enqueue.
- [x] 122. Atualizar `docs/deploy.md` com API, worker, health, logs, rollout e rollback.
- [x] 123. Atualizar `.env.exemple` com roles e configurações novas.
- [x] 124. Criar `docs/platform/worker-operations.md`.
- [x] 125. Atualizar `docs/database/schema.md` somente se houver mudança real de schema por migration aprovada (não aplicável: sem mudança de schema).
- [x] 126. Registrar decisões e desvios descobertos durante implementação em `decisions.md`.

## Validação Final

- [x] 127. Rodar Prettier nos arquivos alterados.
- [x] 128. Rodar `npm run build`.
- [x] 129. Rodar `npm run lint` e revisar mudanças automáticas antes de mantê-las.
- [x] 130. Rodar testes unitários relevantes.
- [ ] 131. Rodar testes de integração PostgreSQL/outbox.
- [ ] 132. Rodar testes de integração BullMQ/Redis dedicados.
- [x] 133. Rodar `npm run test:e2e`.
- [x] 134. Validar que escalar API não aumenta consumers.
- [ ] 135. Validar duas instâncias worker concorrentes.
- [ ] 136. Validar indisponibilidade e recuperação de PostgreSQL, Redis cache e Redis BullMQ.
- [ ] 137. Validar que API não recebe Brevo secret e worker não recebe JWT/OAuth secrets no deploy de teste.
- [x] 138. Revisar diff final contra requirements, design e decisões aprovadas.

## Organização Das Composition Roots

- [x] 139. Criar diretórios `app/api`, `app/worker`, `app/worker/composition`, `app/worker/health`, `app/worker/operations` e `app/shared`.
- [x] 140. Mover e renomear a root HTTP para `ApiModule` e `ApiController`, removendo o `AppService` sem consumidores.
- [x] 141. Mover composição, health e operações do worker para subdiretórios próprios.
- [x] 142. Atualizar entrypoints, testes e imports `@/app`.
- [x] 143. Atualizar documentação operacional e mapa de arquivos atual.
- [x] 144. Rodar build, lint, testes unitários e E2E.
- [x] 145. Confirmar que a reorganização não altera os grafos API/worker.
