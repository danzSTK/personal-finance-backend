---
area: transactions
type: integration
status: current
method: POST
path: /transactions
---

# Create Transaction

Cria uma transaction para o usuário autenticado.

## Request

```http
POST /transactions
Content-Type: application/json
```

### Body - Expense

```json
{
  "accountId": "a6e1a79f-6fbd-441d-93b7-458de6cf1f35",
  "categoryId": "4d8d1ac9-6ce7-4d51-8899-6e9dfd430952",
  "type": "EXPENSE",
  "status": "EFFECTIVE",
  "amountCents": 1990,
  "date": "2026-06-23",
  "description": "Mercado"
}
```

### Body - Transfer

```json
{
  "accountId": "origin-account-id",
  "destinationAccountId": "destination-account-id",
  "type": "TRANSFER",
  "amountCents": 5000,
  "date": "2026-06-23"
}
```

### Body - Adjustment

```json
{
  "accountId": "account-id",
  "type": "ADJUSTMENT",
  "amountCents": 1000,
  "date": "2026-06-23",
  "direction": "INCREASE",
  "description": "Correção de saldo inicial"
}
```

## Category

Para `INCOME` e `EXPENSE`, envie `categoryId` de uma category gerenciável retornada por `GET /categories`.

Para `TRANSFER` e `ADJUSTMENT`, não envie `categoryId`: o backend resolve a category técnica do usuário automaticamente.

## Datas

`date` é `DateOnly`: envie como string `YYYY-MM-DD`.

Não converta `date` para datetime antes de enviar. `2026-06-28` deve ser enviado exatamente como `"2026-06-28"`.

Campos como `effectiveAt`, `createdAt` e `updatedAt` são instantes UTC retornados pelo backend.

## Response

`201 Created`

Retorna o modelo de transaction.

## Erros Esperados

- `VALIDATION_ERROR`
- `INVALID_TRANSACTION`
- `TRANSACTION_ACCOUNT_UNAVAILABLE`
- `TRANSACTION_CATEGORY_UNAVAILABLE`
- `TRANSACTION_CATEGORY_INCOMPATIBLE`
