---
area: transactions
type: flow
status: current
endpoint: POST /transactions
related:
  - ../concepts/transaction.md
  - ../concepts/transaction-type.md
  - ../concepts/transaction-status.md
  - ../concepts/transaction-date.md
  - ../concepts/transaction-amount.md
  - ../reference/invariants.md
---

# Create Transaction

Cria uma transaction para o usuário autenticado.

## Entrada

O controller recebe:

- `accountId`;
- `destinationAccountId` quando `type = TRANSFER`;
- `categoryId` quando `type = INCOME` ou `EXPENSE`;
- `type`;
- `status`, opcional;
- `amountCents`;
- `date`;
- `description`;
- `direction` quando `type = ADJUSTMENT`.

`userId` vem da sessão autenticada.

## Fluxo

1. DTO valida formato de entrada.
2. Controller converte `date` para `Date`.
3. Use case valida account e destination account pelo usuário autenticado.
4. Use case valida category gerenciável para `INCOME`/`EXPENSE` ou resolve category técnica para `TRANSFER`/`ADJUSTMENT`.
5. Use case valida compatibilidade entre transaction type e category type.
6. Factory cria a entidade de domínio.
7. Repository persiste a transaction.
8. Controller retorna `TransactionResponseDto`.

## Regras

- `amountCents` deve ser inteiro positivo.
- `PENDING` nasce sem `effectiveAt`.
- `EFFECTIVE` nasce com `effectiveAt`.
- `TRANSFER` exige origem e destino diferentes.
- `TRANSFER` usa category técnica resolvida pelo backend.
- `ADJUSTMENT` exige `direction` e `description`.
- `ADJUSTMENT` usa category técnica resolvida pelo backend.
- Category arquivada não pode ser usada.
- Account arquivada não pode ser usada.

## Erros

Principais codes:

- `VALIDATION_ERROR`;
- `INVALID_TRANSACTION`;
- `TRANSACTION_ACCOUNT_UNAVAILABLE`;
- `TRANSACTION_CATEGORY_UNAVAILABLE`;
- `TRANSACTION_CATEGORY_INCOMPATIBLE`.
