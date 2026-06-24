---
area: transactions
type: reference
status: current
related:
  - ../../database/schema.md
  - ./invariants.md
---

# Schema

Esta nota acompanha o schema atual de `transactions`.

A fonte de detalhe completa é [Schema do Banco](../../database/schema.md).

## Estado Atual

A tabela `transactions` representa lançamentos financeiros do usuário.

Ela suporta na V0:

- `INCOME`;
- `EXPENSE`;
- `TRANSFER`;
- `ADJUSTMENT`.

Ela também diferencia:

- `PENDING`: previsão, não afeta saldo atual;
- `EFFECTIVE`: realidade financeira, afeta saldo atual quando não deletada.

## Colunas Principais

- `id`: identificador da transaction.
- `user_id`: dono da transaction.
- `account_id`: account principal; em transferência, é a origem.
- `destination_account_id`: destino quando `type = TRANSFER`.
- `category_id`: category usada para classificar a transaction.
- `type`: natureza financeira.
- `status`: previsão ou efetivada.
- `amount_cents`: valor absoluto em centavos.
- `date`: data financeira principal.
- `effective_at`: momento em que a transaction virou realidade financeira.
- `description`: observação; obrigatória para `ADJUSTMENT`.
- `direction`: `INCREASE` ou `DECREASE`, somente para `ADJUSTMENT`.
- `deleted_at`: soft delete técnico.

## Checks Relevantes

- `amount_cents > 0`;
- `PENDING` exige `effective_at IS NULL`;
- `EFFECTIVE` exige `effective_at IS NOT NULL`;
- `TRANSFER` exige `destination_account_id`;
- não-`TRANSFER` exige `destination_account_id IS NULL`;
- `ADJUSTMENT` exige `direction`;
- não-`ADJUSTMENT` exige `direction IS NULL`;
- `ADJUSTMENT` exige `description` não vazia;
- `TRANSFER` não pode ser soft-deletada na V0.

## Índices Relevantes

- listagem por usuário/data/id;
- filtro por status;
- cálculo por account principal efetivada;
- cálculo por destination account efetivada;
- consulta por category.

## Observação

O banco protege invariantes estruturais, mas as regras de ownership, account arquivada, category arquivada e compatibilidade category/type pertencem à aplicação/domínio.
