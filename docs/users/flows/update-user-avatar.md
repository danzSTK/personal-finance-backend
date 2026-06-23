---
area: users
type: flow
status: current
related:
  - ../../assets/README.md
  - ../../storage/README.md
---

# Update User Avatar

Trocar avatar é uma regra do módulo `users`: o usuário decide qual asset representa sua imagem atual. Assets controla o ciclo de vida; Object Storage movimenta os bytes.

## Implementação Atual

- `User.avatarAssetId` representa a referência atual sem levar detalhes de storage para o domínio de users;
- `User.changeAvatarAsset()` troca a referência e registra `UserAvatarUpdatedEvent` somente quando o asset muda;
- `UserRepository.findByIdForUpdate()` bloqueia a linha com `pessimistic_write` durante a transação;
- `UserAvatarUpdatedEventHydrator` valida e reconstitui o evento lido da outbox;
- `AssetMapper` e `IAssetRepository` permitem persistir o ciclo de vida do novo e do antigo asset usando o mesmo `EntityManager`.

## Entrada

- usuário autenticado;
- uma imagem de no máximo 5 MB;
- tipo real aceito pela plataforma.

## Fluxo

1. Users valida autenticação e captura o avatar atual.
2. `file-type` identifica o formato pelos bytes, sem confiar no nome ou MIME enviado.
3. Sharp normaliza dimensões, remove metadata desnecessária e produz WebP.
4. Assets reserva um registro `PENDING_UPLOAD` com purpose `USER_AVATAR`.
5. Object Storage envia o WebP ao R2.
6. Em uma transação PostgreSQL, o novo asset muda para `READY`, `users.avatar_asset_id` aponta para ele e o evento de substituição entra na outbox.
7. O avatar antigo muda para `DELETE_PENDING`.
8. Um consumidor idempotente remove o objeto antigo e marca o asset como `DELETED`.

Evento relacionado: [user.avatar.updated](../../events/user-avatar-updated.md).

## Falhas

- falha antes do upload não altera o avatar atual;
- falha no upload marca o novo asset como `FAILED`;
- objeto enviado com falha posterior no banco será tratado pela reconciliação;
- falha ao excluir o avatar antigo mantém `DELETE_PENDING` para retry.

Endpoint e contrato HTTP: [Update user avatar integration](../../integrations/users/update-user-avatar.md).
