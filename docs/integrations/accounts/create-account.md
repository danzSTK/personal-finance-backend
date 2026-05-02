---
area: accounts
type: integration
status: current
endpoint: POST /accounts
---

# Create Account

Cria uma account para o usuário autenticado.

```http
POST /accounts
```

## Body

```json
{
  "name": "Nubank",
  "type": "BANK",
  "initialBalance": 1000,
  "color": "#8b5cf6",
  "icon": "credit-card",
  "includeInTotal": true,
  "isDefault": false
}
```

## Campos

| Campo | Tipo | Obrigatório | Observação |
|---|---|---:|---|
| `name` | `string` | sim | Nome exibido ao usuário |
| `type` | `CASH \| BANK \| CREDIT_CARD \| INVESTMENT` | sim | Tipo da account |
| `initialBalance` | `number` | não | Default `0` quando omitido |
| `color` | `string` | não | Cor visual da account |
| `icon` | `string` | não | Ícone visual da account |
| `includeInTotal` | `boolean` | não | Define se entra em totais agregados |
| `isDefault` | `boolean` | não | Quando `true`, torna esta account a default |

## Respostas

| Status | Quando |
|---:|---|
| `201` | Account criada |
| `400` | Body inválido |
| `401` | Sessão ausente ou inválida |
| `409` | Conflito de regra de negócio |

## Observação V0

A API atual aceita os tipos do enum. A regra planejada de produto é que `CASH` seja criada automaticamente no onboarding e não por `POST /accounts`.
