---
area: categories
type: integration
status: current
endpoint: GET /categories
---

# List Categories

Lista categorias gerenciáveis do usuário autenticado.

```http
GET /categories
```

Categorias sistêmicas e técnicas não aparecem nesta rota.

## Query Params

| Campo             | Tipo                              | Default | Observação                                 |
| ----------------- | --------------------------------- | ------- | ------------------------------------------ |
| `page`            | `number`                          | `1`     | Inteiro positivo                           |
| `limit`           | `number`                          | `20`    | Entre `1` e `100`                          |
| `type`            | `INCOME \| EXPENSE \| INVESTMENT` | -       | Filtra por tipo gerenciável                |
| `search`          | `string`                          | -       | Busca por `displayName` e `name` canônico  |
| `includeArchived` | `boolean`                         | `false` | Inclui categorias arquivadas quando `true` |

Exemplo:

```http
GET /categories?page=1&limit=20&type=EXPENSE&search=alimentacao
```

## Resposta

```json
{
  "data": [
    {
      "id": "38d192ba-1a87-4f34-a08d-9c51ad49b4a1",
      "name": "alimentacao",
      "displayName": "Alimentação",
      "description": null,
      "type": "EXPENSE",
      "colorToken": "emerald",
      "iconKey": "utensils",
      "isSystem": false,
      "includeInReports": true,
      "isArchived": false,
      "archivedAt": null,
      "sortOrder": 0,
      "isEditable": true,
      "isVisibleInManagement": true,
      "createdAt": "2026-05-23T18:00:00.000Z",
      "updatedAt": "2026-05-23T18:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

## Respostas

| Status | Quando                     |
| -----: | -------------------------- |
|  `200` | Lista carregada            |
|  `400` | Query params inválidos     |
|  `401` | Sessão ausente ou inválida |
