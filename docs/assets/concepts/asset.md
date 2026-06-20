---
area: assets
type: concept
status: current
related:
  - ./asset-purpose.md
  - ./asset-status.md
  - ./storage-key.md
---

# Asset

Um asset é o registro interno de um objeto armazenado fora do banco relacional.

Ele existe para responder:

- quem é o proprietário do objeto;
- por que o objeto existe;
- onde seus bytes estão armazenados;
- se o objeto está disponível, falhou ou aguarda exclusão;
- quais propriedades técnicas foram confirmadas depois do processamento.

`Asset` não contém os bytes e não representa uma URL. Também não conhece Cloudflare R2 nem o SDK S3.

## Identidade E Ownership

- `id` identifica o asset independentemente do objeto físico.
- `userId` identifica o proprietário e sustenta o isolamento multi-tenant.
- `purpose` registra a finalidade do produto.
- `bucket + storageKey` identifica a localização física.

A presença de um `userId` dentro da key não substitui a coluna `user_id` nem deve ser usada para autorização.

## Relação Com Outros Módulos

Módulos consumidores guardam somente o `assetId` referente ao objeto atual. Por exemplo, `users.avatar_asset_id` aponta para o avatar corrente, enquanto assets antigos continuam com ciclo de vida próprio.

A relação ORM é unidirecional: `UserOrmEntity` navega para seu avatar atual. `AssetOrmEntity` não expõe uma relação inversa para “usuário que usa este avatar”, porque ser o avatar atual é responsabilidade de users, não do asset.
