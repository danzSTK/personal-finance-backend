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
| `name` | `string` | Nome exibido ao usuário; mínimo 3 e máximo 255 caracteres; não aceita `null` |
| `type` | `CASH \| BANK \| CREDIT_CARD \| INVESTMENT` | Tipo da account; não aceita `null` |
| `color` | `string \| null` | `null` remove a cor; máximo 20 caracteres |
| `icon` | `string \| null` | `null` remove o ícone; máximo 100 caracteres |
| `includeInTotal` | `boolean` | Define se entra em totais agregados; não aceita `null` |

`initialBalance` não é editado por este endpoint.

## Regras

- Accounts arquivadas não aceitam update comum.
- Body vazio é conflito de regra.
- `userId` vem da sessão, nunca do body.
- Para `CASH`, o frontend deve expor apenas edição de `name`, `color`, `icon` e `includeInTotal`.

## Resposta

```json
{
  "id": "5f6b18c6-1fd9-4e8f-99a8-4a7b65ef56e2",
  "name": "Conta principal",
  "type": "BANK",
  "initialBalance": 1000,
  "color": "#2563eb",
  "icon": "landmark",
  "includeInTotal": true,
  "isArchived": false,
  "isDefault": true,
  "createdAt": "2026-05-02T20:00:00.000Z",
  "updatedAt": "2026-05-02T20:10:00.000Z"
}
```

## Respostas

| Status | Quando |
|---:|---|
| `200` | Account atualizada |
| `400` | Body inválido |
| `401` | Sessão ausente ou inválida |
| `404` | Account não encontrada para o usuário autenticado |
| `409` | Account arquivada ou patch vazio |
