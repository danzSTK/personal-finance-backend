---
area: transactions
type: integration
status: current
method: GET
path: /transactions/:id
---

# Get Transaction

Busca uma transaction por id.

## Response

`200 OK`

Retorna o modelo de transaction.

## Erros Esperados

- `TRANSACTION_NOT_FOUND`

Transactions deletadas ou de outro usuário retornam como não encontradas.
