---
area: accounts
type: integration
status: current
endpoint: PATCH /accounts/:id
---

# Update Account

Atualiza campos editáveis de uma account do usuário autenticado.

```http
PATCH /accounts/:id
```

## Body

Envie pelo menos um campo editável.

```json
{
  "name": "Conta principal",
  "color": "#2563eb",
  "icon": "landmark",
  "includeInTotal": true
}
```

## Campos

| Campo | Tipo | Observação |
|---|---|---|
| `name` | `string` | Nome exibido ao usuário |
| `type` | `CASH \| BANK \| CREDIT_CARD \| INVESTMENT` | Tipo da account |
| `color` | `string \| null` | `null` remove a cor |
| `icon` | `string \| null` | `null` remove o ícone |
| `includeInTotal` | `boolean` | Define se entra em totais agregados |

## Regras

- Accounts arquivadas não aceitam update comum.
- Body vazio é conflito de regra.
- `userId` vem da sessão, nunca do body.

## Respostas

| Status | Quando |
|---:|---|
| `200` | Account atualizada |
| `400` | Body inválido |
| `401` | Sessão ausente ou inválida |
| `404` | Account não encontrada para o usuário autenticado |
| `409` | Account arquivada ou patch vazio |

## Observação V0

A regra planejada é que `CASH` só permita alterar `name`, `color`, `icon` e `includeInTotal`.
