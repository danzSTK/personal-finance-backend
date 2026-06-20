---
area: assets
type: reference
status: current
related:
  - ../../database/schema.md
---

# Assets Schema

A referência completa de colunas, checks, índices e relacionamentos está em [Database schema](../../database/schema.md#assets).

## Resumo

- `assets.user_id` identifica ownership;
- `users.avatar_asset_id` identifica o avatar atual;
- `(bucket, storage_key)` é único;
- índices operacionais apoiam busca por usuário e reconciliação por status;
- `metadata` é JSONB técnico;
- `failure_code` é uma classificação operacional, não HTTP status.

## Checksum

`CHK_assets_checksum` valida apenas o formato contratado para SHA-256: 64 caracteres hexadecimais minúsculos. Ele não calcula o checksum nem consulta o R2.
