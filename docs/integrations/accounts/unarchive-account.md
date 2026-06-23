---
area: accounts
type: integration
status: current
endpoint: PATCH /accounts/:id/unarchive
---

# Unarchive Account

Restaura uma account arquivada.

```http
PATCH /accounts/:id/unarchive
```

## Body

Não possui body.

## Regras

- A account precisa pertencer ao usuário autenticado.
- A account precisa estar arquivada.

## Efeito No Frontend

Este endpoint retorna `204` sem body. Após sucesso, recarregue `GET /accounts?includeArchived=true` ou a lista que estiver em tela.

## Respostas

| Status | Quando |
|---:|---|
| `204` | Account desarquivada |
| `401` | Sessão ausente ou inválida |
| `404` | Account não encontrada para o usuário autenticado |
| `409` | Account já não estava arquivada |
