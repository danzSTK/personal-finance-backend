---
area: integrations
type: contract
status: current
related:
  - ../platform/response-objects.md
---

# Response Objects

Responses JSON podem declarar o shape retornado com a propriedade `object`.

Consumers devem usar `object` para identificar o payload antes de acessar propriedades específicas, principalmente em endpoints com response dinâmico.

## Exemplo

```json
{
  "object": "transaction.list",
  "data": [],
  "summary": {
    "object": "transaction_summary.overview"
  }
}
```

## Identifiers

Identifiers seguem o padrão `module.shape` ou `module_context.shape`.

Valores iniciais:

| Object                         | Uso                                                            |
| ------------------------------ | -------------------------------------------------------------- |
| `transaction.list`             | Response raiz de `GET /transactions`.                          |
| `transaction_summary.type`     | Summary simples quando `GET /transactions` recebe `type`.      |
| `transaction_summary.overview` | Summary agrupado quando `GET /transactions` não recebe `type`. |
| `account.list`                 | Shape reservado para listagem de accounts.                     |

## Regra Para Consumers

Não assuma que uma propriedade existe sem conferir o `object` quando o endpoint documentar mais de um shape possível.
