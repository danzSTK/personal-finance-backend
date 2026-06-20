---
area: assets
type: concept
status: current
related:
  - ./asset-purpose.md
  - ../decisions/generate-storage-keys-outside-asset.md
  - ../../storage/README.md
---

# Storage Key

Storage key é o caminho relativo do objeto dentro de um bucket.

Ela não contém nome do bucket, endpoint R2, protocolo ou URL pública.

Exemplo planejado para avatar:

```text
users/{userId}/avatars/{assetId}.webp
```

## Propriedades Gerais

- não vazia;
- relativa, sem `/` inicial;
- gerada pelo backend;
- única em conjunto com o bucket;
- contém o `assetId` para rastreabilidade;
- segue uma policy própria da finalidade.

## Limite De Responsabilidade

Validar que uma key é relativa cabe ao value object `StorageKey`.

Decidir que `USER_AVATAR` usa a pasta `users/{userId}/avatars` cabe a `AssetStorageKeyFactory`. Colocar todos os formatos dentro de `Asset.validateStorageKey()` obrigaria a entidade a mudar sempre que um purpose novo fosse criado.

O banco valida somente as propriedades estruturais da key e sua unicidade com o bucket. A organização física por purpose fica na factory e não em uma constraint PostgreSQL.
