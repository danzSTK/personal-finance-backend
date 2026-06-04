---
area: categories
type: integration
status: current
endpoint: PATCH /categories/:id/archive
---

# Archive Category

Arquiva uma categoria gerenciável.

```http
PATCH /categories/:id/archive
```

## Regras

- categoria arquivada não é editável;
- categoria arquivada não aparece na listagem padrão;
- categoria arquivada pode aparecer com `includeArchived=true`;
- categoria com transações pode ser arquivada;
- categoria sistêmica ou técnica não pode ser arquivada.

## Respostas

| Status | Quando |
|---:|---|
| `204` | Categoria arquivada |
| `401` | Sessão ausente ou inválida |
| `404` | Categoria não encontrada |
| `409` | Categoria sistêmica ou técnica |
