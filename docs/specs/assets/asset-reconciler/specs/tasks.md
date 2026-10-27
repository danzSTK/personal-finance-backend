---
area: assets
feature: asset-reconciler
type: spec-tasks
status: approved
issue: 127
related:
  - ./requirements.md
  - ./design.md
  - ./decisions.md
---

# Tasks — Asset Reconciler

## 1. Configuração e Interfaces

- [x] 1. Adicionar schema Joi em `api/src/config/config.module.ts` e defaults de `assetReconciliation` em `api/src/config/worker.config.ts`.
- [x] 2. Adicionar método de domínio `recordDeleteFailure` na entidade `Asset` (`api/src/modules/assets/domain/entities/asset.entity.ts`) e declarar `findPendingDeletionBefore` e `findStalePendingUploadsBefore` em `IAssetRepository`.

## 2. Camada de Persistência (TypeORM)

- [x] 3. Implementar `findPendingDeletionBefore` com `FOR UPDATE SKIP LOCKED` e filtro de quarentena em `AssetRepository` (`api/src/modules/assets/infrastructure/persistence/asset.repository.ts`).
- [x] 4. Implementar `findStalePendingUploadsBefore` com `FOR UPDATE SKIP LOCKED` em `AssetRepository`.
- [x] 5. Criar testes unitários para os novos métodos em `asset.repository.spec.ts`.

## 3. Serviço Reconciliador no Worker

- [x] 6. Criar `AssetReconcilerService` em `api/src/modules/assets/application/services/asset-reconciler.service.ts` com ciclo `setInterval` e hooks `OnModuleInit`/`BeforeApplicationShutdown`.
- [x] 7. Implementar lógica de desalocação física no R2, tratamento de 404 idempotente, transição para `DELETED` e salvamento atômico.
- [x] 8. Implementar captura de erro de rede, backoff, incremento de `metadata.delete_attempts` e quarentena (`metadata.quarantine = true`).
- [x] 9. Implementar varredura secundária de expiração de `PENDING_UPLOAD` para `FAILED` (`UPLOAD_TIMEOUT`).
- [x] 10. Criar suíte completa de testes unitários em `asset-reconciler.service.spec.ts`.

## 4. Integração no Container do Worker

- [x] 11. Criar `AssetsWorkerModule` (`api/src/modules/assets/assets-worker.module.ts`) e importá-lo em `api/src/app/worker/worker.module.ts`.
- [x] 12. Adicionar variáveis de ambiente com documentação no `.env.exemple`.

## 5. Validação Final e QA

- [x] 13. Executar suite de testes (`npm test`) e lint (`npm run lint`).
- [x] 14. Validar inicialização do processo worker com o novo reconciliador ativo.
