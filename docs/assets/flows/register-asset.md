---
area: assets
type: flow
status: draft
related:
  - ../concepts/asset.md
  - ../concepts/storage-key.md
---

# Register Asset

Reserva a identidade e a localização de um objeto antes do upload.

## Fluxo Planejado

1. O caso de uso consumidor valida ownership e finalidade.
2. Um UUID é reservado para o asset.
3. A factory de key gera a localização canônica.
4. O asset nasce como `PENDING_UPLOAD`.
5. O repository persiste a linha.

Registrar um asset não significa que seus bytes já existem no R2.
