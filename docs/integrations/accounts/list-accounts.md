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
    "id": "5f6b18c6-1fd9-4e8f-99a8-4a7b65ef56e2",
    "name": "Carteira",
    "type": "CASH",
    "initialBalance": 0,
    "color": null,
    "icon": null,
    "includeInTotal": true,
    "isArchived": false,
    "isDefault": true,
    "createdAt": "2026-05-02T20:00:00.000Z",
    "updatedAt": "2026-05-02T20:00:00.000Z"
  }
]
```

## Ordenação

A listagem retorna a default primeiro e, depois, as accounts por data de criação crescente.

## Estados Importantes Para UI

- `isArchived=false`: account ativa.
- `isArchived=true`: account arquivada; só aparece quando `includeArchived=true`.
- `isDefault=true`: account padrão do usuário.
- `includeInTotal=false`: account não entra nos totais agregados do usuário.

Para usuário recém-criado, a lista pode ficar vazia por alguns instantes até a `CASH` default ser provisionada pela outbox.

## Respostas

| Status | Quando |
|---:|---|
| `200` | Lista retornada |
| `401` | Sessão ausente ou inválida |
