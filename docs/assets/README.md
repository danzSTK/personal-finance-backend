---
area: assets
type: index
status: current
---

# Assets

Assets é o módulo responsável pelo registro persistido e pelo ciclo de vida dos objetos externos usados pela plataforma.

O PostgreSQL guarda identidade, ownership, finalidade, localização e estado. O Object Storage guarda os bytes. Essa separação permite reconciliar falhas, substituir objetos e limpar órfãos sem fazer uma entidade como `User` conhecer bucket, key ou SDK S3.

Para a infraestrutura técnica R2/S3, veja [Object Storage](../storage/README.md).

## Canvas

- [Assets canvas](./assets.canvas)

## Mapa

### Conceitos

- [Asset](./concepts/asset.md)
- [Asset purpose](./concepts/asset-purpose.md)
- [Asset status](./concepts/asset-status.md)
- [Storage key](./concepts/storage-key.md)
- [Asset metadata](./concepts/asset-metadata.md)

### Fluxos

- [Register asset](./flows/register-asset.md)
- [Confirm asset upload](./flows/confirm-asset-upload.md)
- [Delete asset](./flows/delete-asset.md)
- [Reconcile assets](./flows/reconcile-assets.md)

### Decisões

- [Persist asset metadata separately](./decisions/persist-asset-metadata-separately.md)
- [Generate storage keys outside Asset](./decisions/generate-storage-keys-outside-asset.md)
- [Retain deleted asset records](./decisions/retain-deleted-asset-records.md)

### Referência

- [Schema](./reference/schema.md)
- [Invariants](./reference/invariants.md)
- [Open questions](./reference/open-questions.md)

## Estado Atual

Implementado:

- migration `assets` e `users.avatar_asset_id`;
- `AssetPurpose.USER_AVATAR`;
- estados do ciclo de vida;
- entidade de domínio e entidade ORM;
- `StorageKey` value object e factories de criação/key;
- `AssetMapper`, `IAssetRepository` e implementação TypeORM com suporte a transações;
- binding do repository no `AssetsModule`;
- registro do módulo no NestJS e TypeORM.

Pendente:

- casos de uso de registro, confirmação e remoção;
- integração HTTP e processamento de imagem do avatar;
- consumidor idempotente para remover o avatar substituído;
- reconciliação e limpeza.
