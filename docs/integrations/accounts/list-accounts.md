---
area: accounts
type: integration
status: current
endpoint: GET /accounts
---

# List Accounts

Lista accounts do usuário autenticado.

```http
GET /accounts
```

Por padrão, accounts arquivadas não aparecem.

## Query params

| Campo | Tipo | Default | Observação |
|---|---|---|---|
| `includeArchived` | `boolean` | `false` | Quando `true`, inclui accounts arquivadas |

## Exemplo

```http
GET /accounts?includeArchived=true
```

## Resposta

```json
[
  {
    "id": "acc_123",
    "userId": "user_123",
    "name": "Carteira",
    "type": "CASH",
    "initialBalance": 0,
    "color": "#16a34a",
    "icon": "wallet",
    "includeInTotal": true,
    "isArchived": false,
    "archivedAt": null,
    "isDefault": true,
    "createdAt": "2026-05-02T20:00:00.000Z",
    "updatedAt": "2026-05-02T20:00:00.000Z"
  }
]
```

## Respostas

| Status | Quando |
|---:|---|
| `200` | Lista retornada |
| `401` | Sessão ausente ou inválida |
