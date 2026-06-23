---
area: transactions
type: concept
status: draft
related:
  - ./transaction.md
  - ./transaction-date.md
  - ../decisions/pending-transactions-do-not-affect-current-balance.md
---

# Transaction Status

Transaction status representa se o lançamento já aconteceu de fato ou ainda é uma previsão.

## Status Planejados Para V0

### `PENDING`

A transaction foi registrada ou planejada, mas ainda não foi confirmada como realizada.

Regra planejada:

- não afeta saldo atual;
- pode afetar saldo previsto;
- pode ser confirmada depois.

### `EFFECTIVE`

A transaction aconteceu de fato.

Regra planejada:

- afeta saldo atual;
- entra no histórico financeiro real.

## Estado Lógico Derivado

Uma transaction `PENDING` pode ser interpretada como futura ou atrasada a partir da data financeira.

Esse estado pode ser derivado por data e não precisa necessariamente virar enum na V0.
