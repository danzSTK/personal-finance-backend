---
area: transactions
type: flow
status: current
endpoint: DELETE /transactions/:id
related:
  - ../concepts/transaction-deletion.md
  - ../decisions/transactions-can-be-deleted.md
  - ../reference/invariants.md
---

# Delete Transaction

Remove uma transaction do histórico ativo do usuário, quando a regra de domínio permitir.

## Entrada

Recebe apenas o `id` da transaction por path param.

`userId` vem da sessão autenticada.

## Fluxo

1. Use case busca transaction não deletada do usuário.
2. Entidade valida se a transaction pode ser deletada.
3. Entidade preenche `deletedAt`.
4. Repository salva a transaction.
5. Controller responde `204 No Content`.

## Regras

- `TRANSFER` não pode ser deletada na V0.
- `PENDING` deletada sai de pendências e projeções.
- `EFFECTIVE` deletada deixa de afetar saldo atual.
- Delete é comportamento de produto; internamente usa `deletedAt`.

## Erros

Principais codes:

- `TRANSACTION_NOT_FOUND`;
- `TRANSACTION_CANNOT_DELETE_TRANSFER`.
