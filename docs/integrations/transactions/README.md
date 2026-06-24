---
area: transactions
type: integration
status: current
---

# Transactions Integration

Este diretório descreve como o frontend deve consumir o módulo HTTP de transactions.

Para regras de negócio e decisões arquiteturais, use [Transactions architecture](../../transactions/README.md).

## Autenticação

Todas as rotas exigem sessão autenticada por cookies HttpOnly.

Use:

- `credentials: 'include'` no `fetch`;
- `withCredentials: true` no `axios`.

O `userId` sempre vem da sessão autenticada. O frontend nunca deve enviar `userId`.

## Endpoints

- [Create transaction](./create-transaction.md)
- [List transactions](./list-transactions.md)
- [Get transaction](./get-transaction.md)
- [Update transaction](./update-transaction.md)
- [Confirm transaction](./confirm-transaction.md)
- [Delete transaction](./delete-transaction.md)

## Modelo De Resposta

```json
{
  "id": "2f9f2b7d-881e-41bd-9cde-27f7e10f30f0",
  "accountId": "a6e1a79f-6fbd-441d-93b7-458de6cf1f35",
  "destinationAccountId": null,
  "categoryId": "4d8d1ac9-6ce7-4d51-8899-6e9dfd430952",
  "type": "EXPENSE",
  "status": "EFFECTIVE",
  "amountCents": 1990,
  "date": "2026-06-23",
  "effectiveAt": "2026-06-23T12:00:00.000Z",
  "description": "Mercado",
  "direction": null,
  "createdAt": "2026-06-23T12:00:00.000Z",
  "updatedAt": "2026-06-23T12:00:00.000Z"
}
```

## Amount

Transactions usam `amountCents`.

O frontend deve converter o valor digitado para centavos antes de chamar a API.

Exemplos:

- R$ 19,90 -> `1990`
- R$ 100,00 -> `10000`

Nunca envie valor negativo. O sinal financeiro vem de `type` e, em ajustes, de `direction`.

## Types

- `INCOME`: entrada de dinheiro.
- `EXPENSE`: saída de dinheiro.
- `TRANSFER`: movimentação entre accounts próprias.
- `ADJUSTMENT`: correção técnica de saldo.

`TRANSFER` e `ADJUSTMENT` usam categories técnicas criadas pelo backend.

Essas categories técnicas não aparecem nas rotas de gestão de categories e não precisam ser enviadas pelo frontend. Para `TRANSFER` e `ADJUSTMENT`, o backend resolve internamente a category correta. `categoryId` só deve ser enviado para `INCOME` e `EXPENSE`.

## Status

- `PENDING`: previsão; não afeta saldo atual.
- `EFFECTIVE`: lançamento realizado; afeta saldo atual.

Estados como atrasado/futuro devem ser derivados pelo frontend usando `status` e `date`.

## Direction

`direction` só existe em `ADJUSTMENT`:

- `INCREASE`
- `DECREASE`

Para outros types, `direction` deve ser omitido.

## Cache Do Frontend

Após mutations que retornam body, atualize o cache local com o response.

Após `DELETE /transactions/:id`, remova a transaction da lista local ou recarregue `GET /transactions`.
