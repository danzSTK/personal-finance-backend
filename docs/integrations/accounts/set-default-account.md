---
area: accounts
type: integration
status: current
endpoint: PATCH /accounts/:id/default
---

# Set Default Account

Define uma account como default do usuário autenticado.

```http
PATCH /accounts/:id/default
```

## Body

Não possui body.

## Regras

- A account precisa pertencer ao usuário autenticado.
- Account arquivada não pode virar default.
- Se já existir outra default ativa, ela deixa de ser default.
- O usuário deve terminar com uma única default ativa.

## Respostas

| Status | Quando |
|---:|---|
| `204` | Default alterada |
| `401` | Sessão ausente ou inválida |
| `404` | Account não encontrada para o usuário autenticado |
| `409` | Account arquivada ou já era default |
