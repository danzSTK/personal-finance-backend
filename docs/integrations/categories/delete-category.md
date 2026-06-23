---
area: categories
type: integration
status: current
endpoint: DELETE /categories/:id
---

# Delete Category

Remove fisicamente uma categoria sem transações vinculadas.

```http
DELETE /categories/:id
```

## Quando Usar

Use esta rota quando o frontend souber que a categoria não possui transactions.

Se a categoria possui transactions, use [Delete category with merge](./delete-category-with-merge.md).

## Regras

- não deleta categoria sistêmica;
- não deleta categoria técnica;
- não deleta categoria de outro usuário;
- não deleta categoria com transactions vinculadas;
- pode deletar categoria ativa ou arquivada, desde que não tenha transactions.

## Respostas

| Status | Quando |
|---:|---|
| `204` | Categoria deletada |
| `401` | Sessão ausente ou inválida |
| `404` | Categoria não encontrada |
| `409` | Categoria não deletável ou possui transactions |
