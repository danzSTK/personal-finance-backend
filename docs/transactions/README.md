---
area: transactions
type: index
status: current
related:
  - ../accounts/README.md
  - ../categories/README.md
  - ../database/schema.md
---

# Transactions

Este diretório documenta as regras de negócio, decisões arquiteturais e fluxos internos do domínio de transactions.

Na V0, `transactions` registra lançamentos financeiros simples do usuário autenticado.

O módulo atual cobre criação, listagem, busca por id, atualização, confirmação de pendência e delete de lançamentos não-transferência.

## Mapa

### Conceitos

- [Transaction](./concepts/transaction.md)
- [Transaction type](./concepts/transaction-type.md)
- [Transaction status](./concepts/transaction-status.md)
- [Transaction date](./concepts/transaction-date.md)
- [Transaction amount](./concepts/transaction-amount.md)
- [Transaction deletion](./concepts/transaction-deletion.md)

### Fluxos

- [Create transaction](./flows/create-transaction.md)
- [Update transaction](./flows/update-transaction.md)
- [Delete transaction](./flows/delete-transaction.md)
- [Confirm pending transaction](./flows/confirm-pending-transaction.md)
- [Balance adjustment](./flows/balance-adjustment.md)

### Decisões

- [Transaction amount is positive](./decisions/transaction-amount-is-positive.md)
- [Pending transactions do not affect current balance](./decisions/pending-transactions-do-not-affect-current-balance.md)
- [Transfers are neutral](./decisions/transfers-are-neutral.md)
- [Adjustments are technical transactions](./decisions/adjustments-are-technical-transactions.md)
- [Transactions can be deleted](./decisions/transactions-can-be-deleted.md)

### Referência

- [Invariants](./reference/invariants.md)
- [Schema](./reference/schema.md)

## Estado Atual

Implementado:

- tabela `transactions` no schema atual;
- vínculo com `users`, `accounts` e `categories`;
- `amount_cents > 0` protegido por constraint;
- types `INCOME`, `EXPENSE`, `TRANSFER` e `ADJUSTMENT`;
- status `PENDING` e `EFFECTIVE`;
- soft delete técnico por `deleted_at`;
- endpoints HTTP protegidos em `TransactionsController`.

Planejado:

- ampliar testes de use case;
- integrar transactions aos cálculos de saldo e relatórios;
- evoluir features futuras como recorrência, parcelamento e cartão de crédito.

## Limite Desta Documentação

Este diretório não deve documentar regras profundas de `accounts`, `categories`, cartão de crédito, faturas, recorrência, investimentos ou relatórios avançados.

Quando uma transaction depender desses domínios, esta documentação deve referenciar a documentação dona da regra em vez de duplicá-la.
