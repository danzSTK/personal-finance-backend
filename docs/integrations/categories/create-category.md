---
area: categories
type: integration
status: current
endpoint: POST /categories
---

# Create Category

Cria uma categoria gerenciável para o usuário autenticado.

```http
POST /categories
```

## Body

```json
{
  "displayName": "Alimentação",
  "type": "EXPENSE",
  "description": "Gastos com mercado, restaurantes e delivery",
  "colorToken": "emerald",
  "iconKey": "utensils",
  "includeInReports": true,
  "sortOrder": 0
}
```

## Campos

| Campo              | Tipo                              | Obrigatório | Observação                                              |
| ------------------ | --------------------------------- | ----------: | ------------------------------------------------------- |
| `displayName`      | `string`                          |         sim | Nome exibido ao usuário                                 |
| `type`             | `INCOME \| EXPENSE \| INVESTMENT` |         sim | `TRANSFER` e `ADJUSTMENT` são reservados ao backend     |
| `description`      | `string \| null`                  |         não | Descrição opcional                                      |
| `colorToken`       | `string \| null`                  |         não | Token oficial de cor; veja `GET /categories/metadata`   |
| `iconKey`          | `string \| null`                  |         não | Token oficial de ícone; veja `GET /categories/metadata` |
| `includeInReports` | `boolean`                         |         não | Default `true`                                          |
| `sortOrder`        | `number`                          |         não | Default `0`; precisa ser inteiro não negativo           |

## Resposta

Retorna `CategoryResponseDto`.

## Regras Para O Frontend

- Não envie `userId`.
- Não envie `name`; ele é gerado pelo backend.
- Não use este endpoint para criar `TRANSFER` ou `ADJUSTMENT`.
- Envie apenas `iconKey` e `colorToken` presentes em `GET /categories/metadata`.
- Se já existir categoria ativa com mesmo nome canônico e tipo, a API retorna `409`.

## Respostas

| Status | Quando                                      |
| -----: | ------------------------------------------- |
|  `201` | Categoria criada                            |
|  `400` | Body inválido ou tipo técnico enviado       |
|  `401` | Sessão ausente ou inválida                  |
|  `409` | Categoria ativa duplicada para o mesmo tipo |
