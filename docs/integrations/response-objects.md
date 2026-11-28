---
area: integrations
type: contract
status: current
related:
  - ../platform/response-objects/README.md
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

| Object                         | Uso                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `transaction.list`             | Response raiz de `GET /transactions`.                                                |
| `transaction_attachment.item`  | Item de anexo retornado por `GET` e `POST /transactions/:id/attachments`.            |
| `transaction_summary.type`     | Summary simples quando `GET /transactions` recebe `type`.                            |
| `transaction_summary.overview` | Summary agrupado quando `GET /transactions` não recebe `type`.                       |
| `account.list`                 | Shape reservado para listagem de accounts.                                           |
| `fiscal_note.preview`          | Pré-visualização sanitizada e sugestão de despesa de `POST /fiscal-notes/preview`.   |
| `fiscal_note.import`           | Resposta atômica (`transaction` + `fiscalNote`) de `POST /fiscal-notes/import`.       |
| `fiscal_note.item`             | Detalhe completo de `FiscalNote` (`GET /fiscal-notes/:id`, `GET`/`POST /transactions/:id/fiscal-note` e `fiscalNote` de `import`). |
| `fiscal_note.list`             | Response raiz paginado de `GET /fiscal-notes`.                                       |
| `fiscal_note.summary`          | Item leve de listagem em `data[]` de `GET /fiscal-notes` (sem `items[]`/`payments[]`). |
| `fiscal_note.summary_totals`   | Totais financeiros agregados no campo `summary` de `GET /fiscal-notes`.              |

## Regra Para Consumers

Não assuma que uma propriedade existe sem conferir o `object` quando o endpoint documentar mais de um shape possível.
