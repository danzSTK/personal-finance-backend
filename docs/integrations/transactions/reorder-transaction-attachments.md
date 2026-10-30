---
area: transactions
type: integration
status: current
method: PATCH
path: /transactions/:id/attachments/positions
---

# Reorder Transaction Attachments

Reordena a posição visual dos comprovantes na galeria de uma transação.

```http
PATCH /transactions/:id/attachments/positions
Content-Type: application/json
```

## Autenticação

Use o cookie HttpOnly `accessToken` e envie a requisição com credenciais (`credentials: 'include'` ou `withCredentials: true`).

## Path Parameters

| Parâmetro | Tipo   | Obrigatório | Descrição                   |
| --------- | ------ | ----------: | --------------------------- |
| `id`      | `uuid` |         sim | Identificador da transação. |

## Request Body

O corpo deve conter o array com a nova posição de **todos** os anexos da transação:

```json
{
  "positions": [
    {
      "id": "b9344403-c4bd-4e64-8a9b-10f2c44b4434",
      "position": 1
    },
    {
      "id": "f8890ca3-066c-4e19-99f7-7c87bf0ec941",
      "position": 0
    }
  ]
]
```

### Regras de Reordenação
- O array `positions` deve incluir obrigatoriamente **todos** os anexos da transação.
- As posições devem ser números inteiros cobrindo exatamente a faixa `0` a `N-1` (onde `N` é o total de anexos).
- Não podem existir posições duplicadas.

## Resposta `204 No Content`

A requisição não retorna corpo. A nova ordem é salva atomicamente no PostgreSQL.

## Invalidação de Cache no Frontend

Após reordenar com sucesso:
- Invalide a query da galeria da transação: `queryClient.invalidateQueries(['transaction-attachments', transactionId])`.

## Erros Esperados

| Status | Code                           | Quando                                                                                                            |
| -----: | ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
|  `400` | `INVALID_ATTACHMENT_POSITION`  | O payload não cobre todos os anexos, possui posições fora da faixa `0..N-1` ou contém posições duplicadas.       |
|  `401` | `UNAUTHORIZED`                 | Sessão ausente, inválida ou expirada.                                                                             |
|  `404` | `TRANSACTION_NOT_FOUND`        | Transação inexistente, soft-deletada ou pertencente a outro usuário.                                              |
