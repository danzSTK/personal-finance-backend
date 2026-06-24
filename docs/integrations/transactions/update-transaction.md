---
area: transactions
type: integration
status: current
method: PATCH
path: /transactions/:id
---

# Update Transaction

Atualiza dados editáveis de uma transaction.

Esta rota não muda `status`. Para efetivar uma pendência, use [Confirm transaction](./confirm-transaction.md).

## Body

Todos os campos são opcionais, mas pelo menos um deve ser enviado.

```json
{
  "amountCents": 2500,
  "date": "2026-06-24",
  "description": "Valor corrigido"
}
```

Também podem ser enviados:

- `accountId`;
- `destinationAccountId`;
- `categoryId`, somente para `INCOME`/`EXPENSE`;
- `type`;
- `direction`.

Ao atualizar para `TRANSFER` ou `ADJUSTMENT`, não envie `categoryId` técnico. O backend resolve a category técnica correta.

## Response

`200 OK`

Retorna o modelo atualizado.

## Erros Esperados

- `VALIDATION_ERROR`
- `TRANSACTION_NOT_FOUND`
- `TRANSACTION_UPDATE_EMPTY`
- `INVALID_TRANSACTION`
- `TRANSACTION_ACCOUNT_UNAVAILABLE`
- `TRANSACTION_CATEGORY_UNAVAILABLE`
- `TRANSACTION_CATEGORY_INCOMPATIBLE`
