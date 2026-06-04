---
area: categories
type: integration
status: current
---

# Categories Integration

Este diretório descreve como o frontend deve consumir o módulo HTTP de categories.

Para regras de negócio e decisões arquiteturais, use [Categories architecture](../../categories/README.md).

## Autenticação

Todas as rotas exigem sessão autenticada por cookies HttpOnly. Use `credentials: 'include'` no `fetch` ou `withCredentials: true` no `axios`.

O `userId` sempre vem da sessão autenticada. Clientes não devem enviar `userId` no body.

## Endpoints

- [Create category](./create-category.md)
- [Get category metadata](./get-category-metadata.md)
- [List categories](./list-categories.md)
- [Get category](./get-category.md)
- [Update category](./update-category.md)
- [Archive category](./archive-category.md)
- [Unarchive category](./unarchive-category.md)
- [Delete category](./delete-category.md)
- [Delete category with merge](./delete-category-with-merge.md)

## Modelo De Resposta

```json
{
  "id": "38d192ba-1a87-4f34-a08d-9c51ad49b4a1",
  "name": "alimentacao",
  "displayName": "Alimentação",
  "description": "Gastos com mercado, restaurantes e delivery",
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
```

## Tipos

Tipos gerenciáveis pelo frontend:

- `INCOME`
- `EXPENSE`
- `INVESTMENT`

Tipos técnicos reservados ao backend:

- `TRANSFER`
- `ADJUSTMENT`

O frontend não deve tentar criar, editar, arquivar ou deletar categorias técnicas.

## Tokens Visuais

Categorias usam `iconKey` e `colorToken`.

Antes de montar tela de criação/edição, o frontend pode consultar [Get category metadata](./get-category-metadata.md). O backend valida os tokens recebidos e rejeita valores fora do catálogo.

O frontend continua responsável por mapear `iconKey` para componente visual e `colorToken` para classes/tema local.

## Nome

O frontend envia `displayName`.

O backend gera `name`, que é canônico e usado para unicidade e busca.

Exemplo:

```json
{
  "displayName": "Alimentação",
  "name": "alimentacao"
}
```

## Cache Do Frontend

Após mutations que retornam `204`, recarregue `GET /categories` ou remova/atualize o item no cache local.

Após `POST /categories` e `PATCH /categories/:id`, o response já contém a categoria atualizada.
