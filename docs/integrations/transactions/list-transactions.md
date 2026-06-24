---
area: transactions
type: integration
status: current
method: GET
path: /transactions
---

# List Transactions

Lista transactions não deletadas do usuário autenticado.

## Query

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `status` | `PENDING \| EFFECTIVE` | Filtra por status. |
| `type` | `INCOME \| EXPENSE \| TRANSFER \| ADJUSTMENT` | Filtra por type. |
| `accountId` | `uuid` | Filtra transactions em que a account é origem ou destino. |
| `categoryId` | `uuid` | Filtra por category. |
| `dateFrom` | `YYYY-MM-DD` | Data inicial inclusiva. |
| `dateTo` | `YYYY-MM-DD` | Data final inclusiva. |
| `page` | `number` | Página, default `1`. |
| `limit` | `number` | Limite por página, default `20`, máximo `100`. |

## Response

```json
{
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

## Observações

- Transactions deletadas não aparecem.
- `accountId` considera origem e destino de transferência.
- A ordenação padrão é `date DESC`, depois `id DESC`.
