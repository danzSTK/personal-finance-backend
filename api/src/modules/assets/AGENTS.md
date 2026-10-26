# Módulo Assets — Instruções Locais

Este módulo é o responsável exclusivo pelo registro persistido, integridade técnica e ciclo de vida dos arquivos externos armazenados no Object Storage (Cloudflare R2).

## Documentação Obrigatória
Antes de planejar ou alterar código neste módulo, leia:
- `docs/assets/README.md` — Índice e mapa do módulo.
- `docs/assets/concepts/asset-status.md` e `asset-purpose.md` — Máquina de estados do ciclo de vida e finalidades de arquivos.
- `docs/assets/flows/delete-asset.md` e `reconcile-assets.md` — Padrão de desalocação física e reconciliação assíncrona.
- `docs/assets/decisions/asynchronous-deletion-via-reconciler.md` — Motivos do modelo assíncrono via Worker.
- `docs/architecture/module-boundaries.md` — Fronteiras entre módulos de negócio e o módulo de assets.

## Regras de Fronteira e Invariantes
- **Isolamento de SDK/Storage:** Somente o módulo `assets` deve conhecer a porta `IObjectStorage` e interagir com o Cloudflare R2 para desalocação de arquivos.
- **Ciclo de Vida:** O status `DELETED` só pode ser atribuído após a confirmação da remoção física no Object Storage (`deleteObject`).
- **Módulos Consumidores:** Módulos de negócio apenas vinculam `asset_id` e marcam `DELETE_PENDING`. Nunca chame o provedor de storage diretamente de fora de `assets`.
