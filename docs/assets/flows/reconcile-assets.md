---
area: assets
type: flow
status: planned
related:
  - ../concepts/asset-status.md
  - ../reference/open-questions.md
---

# Reconcile Assets

Reconciliação corrige divergências inevitáveis entre PostgreSQL e R2.

## Casos Alvo

- `PENDING_UPLOAD` antigo sem objeto confirmado;
- `FAILED` com objeto parcial ou órfão;
- `DELETE_PENDING` ainda existente no R2;
- linha `READY` cujo objeto não existe;
- objeto no namespace gerenciado sem linha correspondente.

Frequência, retenção e estratégia de listagem ainda precisam ser decididas antes da implementação.
