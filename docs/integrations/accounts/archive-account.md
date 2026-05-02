---
area: accounts
type: integration
status: current
endpoint: PATCH /accounts/:id/archive
---

# Archive Account

Arquiva uma account preservando seu histórico.

```http
PATCH /accounts/:id/archive
```

## Body

Não possui body.

## Regras

- A account precisa pertencer ao usuário autenticado.
- Account default não pode ser arquivada.
- O usuário precisa continuar com pelo menos uma account ativa.
- Account com transações futuras agendadas não pode ser arquivada.

## Respostas

| Status | Quando |
|---:|---|
| `204` | Account arquivada |
| `401` | Sessão ausente ou inválida |
| `404` | Account não encontrada para o usuário autenticado |
| `409` | Regra de arquivamento violada |

## Observação V0

A regra planejada é que `CASH` nunca possa ser arquivada.
