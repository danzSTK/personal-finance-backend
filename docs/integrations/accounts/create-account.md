---
area: accounts
type: integration
status: current
endpoint: POST /accounts
---

# Create Account

Cria uma account para o usuário autenticado. Use este endpoint para contas criadas manualmente pelo usuário.

```http
POST /accounts
```

## Body

```json
{
  "name": "Nubank",
  "type": "BANK",
  "initialBalanceCents": 100000,
  "color": "purple",
  "icon": "credit-card",
  "includeInTotal": true,
  "isDefault": false
}
```

## Campos

| Campo | Tipo | Obrigatório | Observação |
|---|---|---:|---|
| `name` | `string` | sim | Nome exibido ao usuário; mínimo 3 e máximo 255 caracteres |
| `type` | `BANK \| CREDIT_CARD \| INVESTMENT` | sim | Tipo da account criada pelo usuário |
| `initialBalanceCents` | `number` | não | Saldo inicial em centavos; default `0` quando omitido; não aceita valor negativo |
| `color` | `ColorToken \| null` | não | Token oficial de cor; use catálogo de metadata |
| `icon` | `IconKey \| null` | não | Token oficial de ícone; use catálogo de metadata |
| `includeInTotal` | `boolean` | não | Default `true`; define se entra em totais agregados |
| `isDefault` | `boolean` | não | Quando `true`, torna esta account a default |

## Resposta

```json
{
  "id": "5f6b18c6-1fd9-4e8f-99a8-4a7b65ef56e2",
  "name": "Nubank",
  "type": "BANK",
  "initialBalanceCents": 100000,
  "color": "purple",
  "icon": "credit-card",
  "includeInTotal": true,
  "isArchived": false,
  "isDefault": false,
  "createdAt": "2026-05-02T20:00:00.000Z",
  "updatedAt": "2026-05-02T20:00:00.000Z"
}
```

## Regras Para O Frontend

- Não envie `userId`; o backend usa a sessão autenticada.
- Não use `POST /accounts` para criar `CASH`; a `CASH` default é criada pelo backend no onboarding.
- Não envie hex, SVG ou classe CSS em `color`/`icon`; envie apenas tokens oficiais.
- Se `isDefault=true`, a nova account vira default e a default anterior deixa de ser default.
- Se o usuário ainda não tiver default ativa, a nova account pode virar default automaticamente.

## Respostas

| Status | Quando |
|---:|---|
| `201` | Account criada |
| `400` | Body inválido |
| `401` | Sessão ausente ou inválida |
| `409` | Conflito de regra de negócio |
