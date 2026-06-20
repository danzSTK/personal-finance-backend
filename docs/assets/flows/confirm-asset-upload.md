---
area: assets
type: flow
status: planned
related:
  - ../concepts/asset-status.md
  - ../concepts/asset-metadata.md
---

# Confirm Asset Upload

Confirma que o objeto final foi armazenado com sucesso.

## Fluxo Planejado

1. O consumidor processa e valida o arquivo.
2. Object Storage confirma o envio para `bucket + key`.
3. O asset recebe `contentType`, `sizeBytes`, checksum e metadata.
4. O status muda de `PENDING_UPLOAD` para `READY`.
5. A aplicação persiste `ready_at`.

Somente assets `READY` podem ser usados como referência ativa por outro módulo.
