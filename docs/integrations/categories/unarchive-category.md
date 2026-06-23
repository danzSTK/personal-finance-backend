---
area: categories
type: integration
status: current
endpoint: PATCH /categories/:id/unarchive
---

# Unarchive Category

Desarquiva uma categoria gerenciável.

```http
PATCH /categories/:id/unarchive
```

## Regras

- categoria sistêmica ou técnica não pode ser desarquivada por esta rota;
- se já existir categoria ativa com mesmo `type` e `name`, retorna `409`;
- operação não retorna body.

## Respostas

| Status | Quando |
|---:|---|
| `204` | Categoria desarquivada |
| `401` | Sessão ausente ou inválida |
| `404` | Categoria não encontrada |
| `409` | Categoria não gerenciável ou nome duplicado |
