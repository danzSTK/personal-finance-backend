---
area: assets
type: index
status: current
last_reviewed: 2026-07-23
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
- casos de uso de atualização e remoção de avatar integrados ao Object Storage;
- processamento e validação de imagem antes do upload;
- endpoints HTTP de atualização e remoção de avatar;
- consumidores idempotentes para remover assets substituídos ou removidos.

Pendente:

- reconciliação periódica de objetos órfãos e assets presos em estados intermediários;
- expansão para outros tipos de asset além de `USER_AVATAR`.
