---
area: events
type: event
status: current
eventName: user.avatar.removed
eventVersion: 1
aggregateType: User
related:
  - ./README.md
  - ./events-map.canvas
  - ../users/flows/remove-user-avatar.md
  - ../assets/flows/delete-asset.md
---

# UserAvatarRemovedEvent

`user.avatar.removed` representa a remoção explícita da referência de avatar de um usuário.

## Contrato

| Campo             | Tipo     | Descrição                            |
| ----------------- | -------- | ------------------------------------ |
| `userId`          | `string` | Usuário que removeu o avatar         |
| `previousAssetId` | `string` | Asset que deixou de ser referenciado |

## Produção

`RemoveUserAvatarUseCase` bloqueia o usuário, chama `User.removeAvatarAsset()`, salva o usuário e grava o evento na outbox dentro da mesma transação.

Se o usuário já estiver sem avatar, a operação termina sem alterar o aggregate e sem produzir evento.

## Consumo

`DeleteRemovedAvatarOnUserHandler` chama `DeleteAvatarAssetUseCase` com `previousAssetId`.

O consumidor retoma assets em `DELETE_PENDING`, considera `DELETED` como sucesso e propaga falhas com `suppressErrors: false` para permitir retry da outbox.
