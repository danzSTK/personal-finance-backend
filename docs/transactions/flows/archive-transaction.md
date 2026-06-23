---
area: transactions
type: flow
status: draft
endpoint: PATCH /transactions/:id/archive
related:
  - ../concepts/transaction.md
  - ../reference/invariants.md
---

# Archive Transaction

Arquiva uma transaction sem remover o histórico físico imediatamente.

## Fluxo Planejado

1. Controller recebe o identificador da transaction.
2. `userId` vem de `@CurrentUser()`.
3. Use case busca a transaction por `id` e `userId`.
4. Use case valida se a transaction pode ser arquivada.
5. Entidade marca a transaction como arquivada/inativa.
6. Repositório persiste o novo estado.
7. Controller retorna `204` ou a representation atualizada.

## Observação

O schema atual usa `is_active` e `deactivated_at` como soft delete legado.

A nomenclatura final entre archive, deactivate e delete ainda precisa ser validada.
