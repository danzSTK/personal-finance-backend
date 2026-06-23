---
area: assets
type: flow
status: current
related:
  - ../concepts/asset-status.md
  - ../decisions/retain-deleted-asset-records.md
  - ../../events/user-avatar-updated.md
---

# Delete Asset

Remove um objeto que deixou de ser referenciado.

## Fluxo Atual Para Avatares Substituídos

1. O consumidor remove ou substitui a referência ativa.
2. O asset muda para `DELETE_PENDING`.
3. Um handler ou job solicita remoção idempotente no Object Storage.
4. Objeto ausente também é tratado como sucesso de remoção.
5. O asset muda para `DELETED` e recebe `deleted_at`.

Se o provider falhar temporariamente, o status permanece `DELETE_PENDING` para retry.

Na substituição e na remoção explícita de avatar, os handlers usam `previousAssetId` para chamar `DeleteAvatarAssetUseCase`. A repetição do evento, um objeto ausente no R2 e um asset já `DELETED` resultam em sucesso idempotente.

Se a exclusão externa falhar, o asset permanece `DELETE_PENDING`; o erro é propagado para que a outbox tente novamente.
