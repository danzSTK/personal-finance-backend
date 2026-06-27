---
area: users
type: flow
status: current
related:
  - ./update-user-avatar.md
  - ../../events/user-avatar-removed.md
  - ../../assets/flows/delete-asset.md
---

# Remove User Avatar

Remove a referência de avatar do usuário sem bloquear a request esperando o Object Storage.

## Fluxo

1. A rota autentica o usuário.
2. `RemoveUserAvatarUseCase` abre uma transação e bloqueia a linha do usuário.
3. `User.removeAvatarAsset()` troca `avatarAssetId` para `null`.
4. Usuário e `UserAvatarRemovedEvent` são persistidos na mesma transação.
5. A request retorna `204`.
6. O consumidor de `assets` remove o objeto anterior e finaliza seu estado como `DELETED`.

## Idempotência

Se `avatarAssetId` já for `null`, a rota também retorna `204`. Nesse caso não há escrita do usuário, invalidação de cache nem evento.

Falhas assíncronas mantêm o asset em `DELETE_PENDING` e provocam retry da outbox.

## Throttling

`DELETE /users/me/avatar` usa o mesmo limite de troca de avatar: 3 tentativas por minuto e bloqueio por 1 hora após exceder o limite.

Integração HTTP: [Remove user avatar](../../integrations/users/remove-user-avatar.md).
