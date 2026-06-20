---
area: assets
type: concept
status: current
related:
  - ./asset.md
  - ../flows/delete-asset.md
---

# Asset Status

Status representa a situação persistida do objeto em relação ao storage.

| Status | Significado |
| --- | --- |
| `PENDING_UPLOAD` | A identidade e localização foram reservadas, mas o upload ainda não foi confirmado. |
| `READY` | O objeto processado está armazenado e disponível. |
| `DELETE_PENDING` | O objeto deixou de ser usado e aguarda exclusão física idempotente. |
| `DELETED` | A exclusão física foi confirmada; a linha permanece para auditoria. |
| `FAILED` | O processamento ou upload inicial falhou antes de ficar pronto. |

## Transições

```text
PENDING_UPLOAD -> READY -> DELETE_PENDING -> DELETED
       |
       +----------> FAILED -> DELETE_PENDING -> DELETED
```

Falhar ao remover um objeto não deve marcar imediatamente o asset como `FAILED`. Ele permanece `DELETE_PENDING` para permitir retry da mesma intenção.
