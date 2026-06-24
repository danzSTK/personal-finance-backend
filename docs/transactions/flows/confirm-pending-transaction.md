---
area: transactions
type: flow
status: current
endpoint: PATCH /transactions/:id/confirm
related:
  - ../concepts/transaction-status.md
  - ../concepts/transaction-date.md
  - ../decisions/pending-transactions-do-not-affect-current-balance.md
---

# Confirm Pending Transaction

Confirma uma transaction pendente como realizada.

## Entrada

O body pode ser vazio ou conter os mesmos campos editáveis do update:

- `accountId`;
- `destinationAccountId`;
- `categoryId`, quando o próximo type for `INCOME` ou `EXPENSE`;
- `type`;
- `amountCents`;
- `date`;
- `description`;
- `direction`.

## Fluxo

1. Use case busca transaction não deletada do usuário.
2. Use case rejeita transaction já `EFFECTIVE`.
3. Use case valida as referências depois dos ajustes opcionais e resolve category técnica para `TRANSFER`/`ADJUSTMENT`.
4. Entidade aplica o patch opcional.
5. Entidade muda status para `EFFECTIVE`.
6. Entidade preenche `effectiveAt`.
7. Repository salva e retorna a transaction.

## Impacto

Depois de confirmada, a transaction passa a afetar saldo atual conforme seu type.

## Erros

Principais codes:

- `TRANSACTION_NOT_FOUND`;
- `TRANSACTION_ALREADY_EFFECTIVE`;
- `INVALID_TRANSACTION`;
- `TRANSACTION_ACCOUNT_UNAVAILABLE`;
- `TRANSACTION_CATEGORY_UNAVAILABLE`;
- `TRANSACTION_CATEGORY_INCOMPATIBLE`.
