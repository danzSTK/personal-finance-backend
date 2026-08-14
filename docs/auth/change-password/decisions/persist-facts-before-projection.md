---
area: auth
type: decision
status: current
related:
  - ./postgres-authority-redis-projection.md
  - ./immediate-and-durable-reconciliation.md
---

# Persistir fatos antes da projeção

## Decisão

PostgreSQL e outbox sofrem commit antes de qualquer reconstrução do Redis.

## Motivos

- A projeção não pode afirmar que uma falha, bloqueio ou alteração aconteceu se
  a transação durável foi revertida.
- O banco é a fonte usada para reconstruir o estado.

## Consequências

- Redis pode ficar temporariamente atrasado, mas não origina fatos novos.
- Falha pós-commit é tratada por reconciliação, sem rollback da senha.
- Crash pré-commit deixa apenas uma barreira temporária, que expira por TTL.
