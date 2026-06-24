---
area: transactions
type: integration
status: current
method: DELETE
path: /transactions/:id
---

# Delete Transaction

Remove uma transaction do histórico ativo.

## Response

`204 No Content`

## Regras

- `INCOME`, `EXPENSE` e `ADJUSTMENT` podem ser deletadas.
- `TRANSFER` não pode ser deletada na V0.
- Transaction deletada não aparece nas listagens comuns.
- Transaction deletada não afeta saldo atual ou previsto.

## Erros Esperados

- `TRANSACTION_NOT_FOUND`
- `TRANSACTION_CANNOT_DELETE_TRANSFER`
