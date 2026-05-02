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

## Respostas

| Status | Quando |
|---:|---|
| `204` | Account desarquivada |
| `401` | Sessão ausente ou inválida |
| `404` | Account não encontrada para o usuário autenticado |
| `409` | Account já não estava arquivada |
