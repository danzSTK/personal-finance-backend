---
area: transactions
type: integration
status: current
method: PATCH
path: /transactions/:id/confirm
---

# Confirm Transaction

Confirma uma transaction `PENDING` como `EFFECTIVE`.

O body pode ser vazio ou conter ajustes finais antes da confirmação.

Se o ajuste mudar ou confirmar como `TRANSFER`/`ADJUSTMENT`, não envie `categoryId` técnico. O backend resolve a category técnica correta.

## Request

```http
PATCH /transactions/:id/confirm
Content-Type: application/json
```

```json
{
  "amountCents": 2500,
  "date": "2026-06-24"
}
```

## Response

`200 OK`

Retorna a transaction com:

- `status = EFFECTIVE`;
- `effectiveAt` preenchido.

## Erros Esperados

- `TRANSACTION_NOT_FOUND`
- `TRANSACTION_ALREADY_EFFECTIVE`
- `INVALID_TRANSACTION`
- `TRANSACTION_ACCOUNT_UNAVAILABLE`
- `TRANSACTION_CATEGORY_UNAVAILABLE`
- `TRANSACTION_CATEGORY_INCOMPATIBLE`
