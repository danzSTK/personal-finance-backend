---
area: assets
type: decision
status: accepted
related:
  - ../concepts/asset-status.md
  - ../flows/delete-asset.md
---

# Manter Registros De Assets Excluídos

## Decisão

Confirmar a remoção física com status `DELETED` e `deleted_at`, sem apagar imediatamente a linha.

## Motivos

- auditoria do ciclo de vida;
- idempotência de handlers e jobs;
- diagnóstico de referências antigas;
- distinção entre objeto removido e registro que nunca existiu.

Uma política futura poderá remover registros antigos depois de uma janela de retenção definida.
