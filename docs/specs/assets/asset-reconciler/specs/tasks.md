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

- [ ] 1. Adicionar schema e defaults de `assetReconciliation` em `api/src/config/worker.config.ts`.
- [ ] 2. Declarar métodos `findPendingDeletionBefore` e `findStalePendingUploadsBefore` na interface `IAssetRepository` (`api/src/modules/assets/domain/repositories/asset.repository.interface.ts`).

## 2. Camada de Persistência (TypeORM)

- [ ] 3. Implementar `findPendingDeletionBefore` com `FOR UPDATE SKIP LOCKED` e filtro de quarentena em `AssetRepository` (`api/src/modules/assets/infrastructure/persistence/asset.repository.ts`).
- [ ] 4. Implementar `findStalePendingUploadsBefore` com `FOR UPDATE SKIP LOCKED` em `AssetRepository`.
- [ ] 5. Criar testes unitários para os novos métodos em `asset.repository.spec.ts`.

## 3. Serviço Reconciliador no Worker

- [ ] 6. Criar `AssetReconcilerService` em `api/src/modules/assets/application/services/asset-reconciler.service.ts` com ciclo `setInterval` e hooks `OnModuleInit`/`BeforeApplicationShutdown`.
- [ ] 7. Implementar lógica de desalocação física no R2, tratamento de 404 idempotente, transição para `DELETED` e salvamento atômico.
- [ ] 8. Implementar captura de erro de rede, backoff, incremento de `metadata.delete_attempts` e quarentena (`metadata.quarantine = true`).
- [ ] 9. Implementar varredura secundária de expiração de `PENDING_UPLOAD` para `FAILED` (`UPLOAD_TIMEOUT`).
- [ ] 10. Criar suíte completa de testes unitários em `asset-reconciler.service.spec.ts`.

## 4. Integração no Container do Worker

- [ ] 11. Declarar e exportar `AssetReconcilerService` no módulo de assets ou registrar como provider em `api/src/app/worker/worker.module.ts`.
- [ ] 12. Adicionar variáveis de ambiente com documentação no `.env.example`.

## 5. Validação Final e QA

- [ ] 13. Executar suite de testes (`npm test`) e lint (`npm run lint`).
- [ ] 14. Validar inicialização do processo worker com o novo reconciliador ativo.
