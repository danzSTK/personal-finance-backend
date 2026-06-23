---
area: categories
type: integration
status: current
endpoint: GET /categories/:id
---

# Get Category

Busca uma categoria gerenciável específica.

```http
GET /categories/:id
```

## Regras

- retorna apenas categoria do usuário autenticado;
- retorna `404` para categoria inexistente;
- retorna `404` para categoria sistêmica ou técnica;
- não retorna categorias de outro usuário.

## Resposta

Retorna `CategoryResponseDto`.

## Respostas

| Status | Quando |
|---:|---|
| `200` | Categoria encontrada |
| `401` | Sessão ausente ou inválida |
| `404` | Categoria inexistente, técnica, sistêmica ou de outro usuário |
