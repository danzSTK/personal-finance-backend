---
area: assets
type: reference
status: current
related:
  - ../concepts/asset.md
  - ../concepts/asset-status.md
---

# Assets Invariants

## Atuais

- todo asset possui `id`, `userId`, `purpose`, bucket e key;
- status pertence ao ciclo conhecido;
- `bucket + storageKey` é único;
- key é relativa e não começa com `/`;
- formato da key por purpose é gerado pela `AssetStorageKeyFactory`, não validado pela entidade ou pelo banco;
- tamanho, quando presente, não é negativo;
- checksum, quando presente, segue SHA-256 hexadecimal minúsculo;
- metadata é um objeto JSON;
- `READY` exige `ready_at`;
- `DELETED` exige `deleted_at`;
- `FAILED` exige `failure_code`;
- transições inválidas são rejeitadas pelo domínio.

## Planejadas

- somente asset `READY` pode virar referência ativa;
- módulos consumidores só podem referenciar assets do mesmo usuário;
- bucket e key nunca vêm diretamente do frontend;
- remoção física é idempotente;
- URL pública é derivada e não persistida.
