---
area: transactions
type: flow
status: deprecated
related:
  - ../concepts/transaction-deletion.md
  - ../decisions/transactions-can-be-deleted.md
---

# Archive Transaction

Transactions não devem ser arquivadas.

Este fluxo não faz parte da V0.

## Decisão

Transaction representa histórico financeiro.

Se o usuário precisa remover uma transaction do histórico ativo, o comportamento de produto é delete.

Archive deve continuar sendo usado para cadastros como account e category, não para transaction.

## Referência

Use:

- [Transaction deletion](../concepts/transaction-deletion.md)
- [Transactions can be deleted](../decisions/transactions-can-be-deleted.md)
- [Delete transaction](./delete-transaction.md)
