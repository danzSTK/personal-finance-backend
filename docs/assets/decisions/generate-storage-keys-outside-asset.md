---
area: assets
type: decision
status: current
related:
  - ../concepts/storage-key.md
  - ../concepts/asset-purpose.md
---

# Gerar Storage Keys Fora De Asset

## Contexto

A implementação inicial comparava a key recebida com o formato completo dentro de `Asset.validateStorageKey()` e repetia essa regra em uma constraint PostgreSQL.

Isso garante consistência para o primeiro purpose, mas faz a entidade e o schema conhecerem a organização física de cada finalidade futura.

## Decisão

Separar duas responsabilidades:

- `StorageKey` value object valida propriedades gerais: valor obrigatório, relativo e dentro do limite permitido;
- uma factory/policy gera a key canônica a partir de `purpose`, `userId`, `assetId` e extensão final confiável.

```text
AssetStorageKeyFactory.create({ purpose, userId, assetId })
  -> StorageKey
  -> users/{userId}/avatars/{assetId}.webp
```

`Asset` recebe uma `StorageKey` já válida e não cresce com um `if` para cada purpose.

## Consequências

- novos purposes adicionam uma policy sem alterar invariantes gerais do asset;
- geração continua centralizada no backend;
- testes da convenção ficam isolados;
- a convenção por purpose não é duplicada em uma constraint PostgreSQL.
