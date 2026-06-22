---
area: assets
type: flow
status: planned
related:
  - ../concepts/asset-status.md
  - ../decisions/retain-deleted-asset-records.md
  - ../../events/user-avatar-updated.md
---

# Delete Asset

Remove um objeto que deixou de ser referenciado.

## Fluxo Planejado

1. O consumidor remove ou substitui a referência ativa.
2. O asset muda para `DELETE_PENDING`.
3. Um handler ou job solicita remoção idempotente no Object Storage.
4. Objeto ausente também é tratado como sucesso de remoção.
5. O asset muda para `DELETED` e recebe `deleted_at`.

Se o provider falhar temporariamente, o status permanece `DELETE_PENDING` para retry.

Na substituição de avatar, o consumidor planejado de `user.avatar.updated` usa `previousAssetId` para iniciar esse fluxo. A repetição do evento e um objeto já ausente precisam resultar em sucesso idempotente.
