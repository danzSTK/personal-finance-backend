---
area: categories
type: integration
status: current
endpoint: PATCH /categories/:id
---

# Update Category

Atualiza uma categoria ativa e gerenciável.

```http
PATCH /categories/:id
```

## Body

Todos os campos são opcionais, mas pelo menos um precisa ser enviado.

```json
{
  "displayName": "Mercado",
  "description": "Supermercado e feira",
  "colorToken": "green",
  "iconKey": "shopping-cart",
  "includeInReports": true,
  "sortOrder": 1
}
```

## Campos

| Campo              | Tipo             | Observação                                                                      |
| ------------------ | ---------------- | ------------------------------------------------------------------------------- |
| `displayName`      | `string`         | Recalcula o `name` canônico                                                     |
| `description`      | `string \| null` | Pode limpar descrição com `null`                                                |
| `colorToken`       | `string \| null` | Pode limpar cor com `null`; valores válidos vêm de `GET /categories/metadata`   |
| `iconKey`          | `string \| null` | Pode limpar ícone com `null`; valores válidos vêm de `GET /categories/metadata` |
| `includeInReports` | `boolean`        | Não aceita `null`                                                               |
| `sortOrder`        | `number`         | Inteiro não negativo; não aceita `null`                                         |

## Regras

- não permite atualizar categoria arquivada;
- não permite atualizar categoria sistêmica;
- não permite atualizar categoria técnica;
- não permite mudar o `type`;
- se `displayName` gerar `name` duplicado para o mesmo tipo, retorna `409`.

## Resposta

Retorna `CategoryResponseDto`.

## Respostas

| Status | Quando                                               |
| -----: | ---------------------------------------------------- |
|  `200` | Categoria atualizada                                 |
|  `400` | Body inválido                                        |
|  `401` | Sessão ausente ou inválida                           |
|  `404` | Categoria não encontrada                             |
|  `409` | Categoria não editável, body vazio ou nome duplicado |
