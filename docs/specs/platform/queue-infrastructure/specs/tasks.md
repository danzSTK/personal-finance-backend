---
area: platform
feature: queue-infrastructure
type: spec-tasks
status: current
related:
  - ./requirements.md
  - ./design.md
  - ./decisions.md
---

# Tasks - Queue Infrastructure

## Spec

- [x] 1. Criar requirements da infraestrutura de filas.
- [x] 2. Criar design técnico da infraestrutura de filas.
- [x] 3. Criar tasks de implementação.
- [x] 4. Registrar decisões iniciais.

## Dependências

- [x] 5. Adicionar `@nestjs/bullmq` e `bullmq` em `api/package.json`.
- [x] 6. Atualizar lockfile com as novas dependências.

## Configuração

- [x] 7. Criar `api/src/config/queue.config.ts`.
- [x] 8. Registrar `queueConfig` no load do `ConfigModule`.
- [x] 9. Adicionar validação Joi para variáveis `BULLMQ_*`.
- [x] 10. Atualizar `.env.exemple` com variáveis BullMQ.

## Módulo Base

- [x] 11. Criar `api/src/shared/jobs/jobs.module.ts`.
- [x] 12. Configurar `BullModule.forRootAsync` com `queueConfig`.
- [x] 13. Exportar `BullModule` pelo `JobsModule`.
- [x] 14. Criar `api/src/shared/jobs/constants/queue.constants.ts` apenas com defaults de plataforma.
- [x] 15. Registrar `JobsModule` no `AppModule`.

## Documentação

- [x] 16. Criar `docs/platform/queue-infrastructure.md`.
- [x] 17. Atualizar `docs/platform/README.md`.
- [x] 18. Documentar recomendação de Redis dedicado com `noeviction`.
- [x] 19. Documentar convenção para futuras filas, jobs, payloads versionados e workers.

## Testes

- [x] 20. Adicionar teste unitário para `queue.config.ts`.
- [x] 21. Adicionar teste de wiring do `JobsModule`.
- [x] 22. Garantir que nenhum teste use Redis real para BullMQ nesta etapa.

## Validação

- [x] 23. Rodar build.
- [x] 24. Rodar testes relevantes.
- [x] 25. Rodar lint focado nos arquivos da implementação.

Observação: o lint global foi executado e ainda falha em `api/src/modules/users/application/use-cases/update-username/update-username.use-case.spec.ts`, fora do escopo desta spec.

## Fora Do Escopo Desta Implementação

- [x] 26. Não criar fila de e-mail.
- [x] 27. Não criar processor concreto.
- [x] 28. Não criar módulo `notifications`.
- [x] 29. Não criar producer concreto.

## Ajuste Local Pós-Implementação

- [x] 30. Adicionar Redis dedicado `bullmq-redis` ao Docker Compose.
- [x] 31. Expor Redis de BullMQ localmente em `6381`.
- [x] 32. Configurar Redis de BullMQ com `noeviction`.
- [x] 33. Atualizar `.env.exemple` para apontar BullMQ para o Redis dedicado.
- [x] 34. Atualizar documentação de plataforma sobre Redis dedicado local.
