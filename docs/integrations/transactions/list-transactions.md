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

| Campo        | Tipo                                          | Descrição                                                 |
| ------------ | --------------------------------------------- | --------------------------------------------------------- |
| `status`     | `PENDING \| EFFECTIVE`                        | Filtra por status.                                        |
| `type`       | `INCOME \| EXPENSE \| TRANSFER \| ADJUSTMENT` | Filtra por type.                                          |
| `accountId`  | `uuid`                                        | Filtra transactions em que a account é origem ou destino. |
| `categoryId` | `uuid`                                        | Filtra por category.                                      |
| `dateFrom`   | `YYYY-MM-DD`                                  | Data inicial inclusiva.                                   |
| `dateTo`     | `YYYY-MM-DD`                                  | Data final inclusiva.                                     |
| `page`       | `number`                                      | Página, default `1`.                                      |
| `limit`      | `number`                                      | Limite por página, default `20`, máximo `100`.            |
| `sort`       | `date:desc \| date:asc`                       | Ordenação por data. Default `date:desc`.                  |

## Response Sem `type`

Quando `type` não é enviado, a listagem retorna somente transactions `INCOME` e `EXPENSE`.

```json
{
  "object": "transaction.list",
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "summary": {
    "object": "transaction_summary.overview",
    "income": {
      "pendingCents": 120000,
      "effectiveCents": 300000,
      "totalCents": 420000
    },
    "expense": {
      "pendingCents": 80000,
      "effectiveCents": 150000,
      "totalCents": 230000
    },
    "balance": {
      "pendingDeltaCents": 40000,
      "effectiveDeltaCents": 150000,
      "expectedBalanceCents": 190000
    }
  }
}
```

## Response Com `type`

Quando `type` é enviado, o summary retorna o modelo simples para o tipo filtrado.

```json
{
  "object": "transaction.list",
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "summary": {
    "object": "transaction_summary.type",
    "pendingCents": 80000,
    "effectiveCents": 150000,
    "totalCents": 230000
  }
}
```

## Summary

`summary` resume todas as transactions que atendem aos filtros enviados, sem aplicar `page` e `limit`.

O response raiz sempre usa `object = transaction.list`.

No modelo simples com `type` explícito:

- `summary.object`: `transaction_summary.type`.
- `pendingCents`: soma positiva das transactions `PENDING` do type filtrado.
- `effectiveCents`: soma positiva das transactions `EFFECTIVE` do type filtrado.
- `totalCents`: `pendingCents + effectiveCents`.

No modelo agrupado sem `type`:

- `summary.object`: `transaction_summary.overview`.
- `income`: soma positiva de receitas.
- `expense`: soma positiva de despesas.
- `balance.pendingDeltaCents`: `income.pendingCents - expense.pendingCents`.
- `balance.effectiveDeltaCents`: `income.effectiveCents - expense.effectiveCents`.
- `balance.expectedBalanceCents`: `effectiveDeltaCents + pendingDeltaCents`.

`expectedBalanceCents` representa o resultado líquido esperado da listagem/período, não o saldo projetado da account. Saldo atual e saldo projetado pertencem ao contrato de accounts.

Observações de intenção:

- `income.*Cents` e `expense.*Cents` não são negativos.
- Deltas em `balance` podem ser negativos, positivos ou zero.

## Observações

- Transactions deletadas não aparecem.
- Para saldo atual ou projetado agregado, use `GET /accounts/summary`.
- `accountId` considera origem e destino de transferência.
- Sem `type`, a rota lista somente `INCOME` e `EXPENSE`.
- A ordenação padrão é `date DESC`, depois `id DESC`.
- `sort=date:asc` ordena por `date ASC`, depois `id ASC`.
- `sort=date:desc` ordena por `date DESC`, depois `id DESC`.
- `dateFrom` e `dateTo` são `DateOnly`: strings `YYYY-MM-DD`, sem hora e sem timezone.
