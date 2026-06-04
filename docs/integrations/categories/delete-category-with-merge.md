---
area: categories
type: integration
status: current
endpoint: POST /categories/:id/delete-with-merge
---

# Delete Category With Merge

Move todas as transactions da categoria origem para outra categoria e deleta a origem.

```http
POST /categories/:id/delete-with-merge
```

## Body

```json
{
  "targetCategoryId": "0cc2f492-0f76-4df7-9c2d-170710951ab9"
}
```

## Regras

- origem e destino precisam pertencer ao usuário autenticado;
- origem não pode ser sistêmica ou técnica;
- destino precisa ser categoria ativa e gerenciável;
- destino não pode ser a própria origem;
- destino precisa ter o mesmo `type` da origem;
- a operação é atômica: move todas as transactions e deleta a origem, ou não faz nada.

## UX Recomendada

Quando o frontend detectar que a categoria possui transactions, exiba um fluxo de confirmação pedindo a categoria destino.

Depois de sucesso:

- remova a categoria origem do cache local;
- recarregue a lista de categorias;
- se houver tela de transactions aberta, recarregue a lista de transactions.

## Respostas

| Status | Quando |
|---:|---|
| `204` | Transactions movidas e categoria deletada |
| `400` | Body inválido |
| `401` | Sessão ausente ou inválida |
| `404` | Categoria origem não encontrada |
| `409` | Destino inválido, arquivado, incompatível ou igual à origem |
