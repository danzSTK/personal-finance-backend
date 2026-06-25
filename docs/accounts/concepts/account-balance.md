---
area: accounts
type: concept
status: current
related:
  - ../decisions/account-balance-is-derived.md
  - ../reference/open-questions.md
---

# Account Balance

Saldo de account é um valor derivado do histórico.

Fórmula conceitual:

```text
initialBalanceCents + impactos de transactions
```

## Regra

O saldo não deve ser persistido como coluna na account.

O `initialBalanceCents` é a entrada inicial do cálculo. A regra planejada é permitir sua edição apenas enquanto a account não tiver movimentação; depois disso, correções devem acontecer via transações ou ajustes financeiros.

## Impacto Das Transactions

Para uma account específica:

- `INCOME` efetiva soma valor quando a account é a account da transaction.
- `EXPENSE` efetiva subtrai valor quando a account é a account da transaction.
- `TRANSFER` efetiva subtrai valor da account de origem e soma valor na account de destino.
- `ADJUSTMENT` efetivo soma ou subtrai conforme `direction`.

Transactions `PENDING` não afetam saldo atual. Elas podem entrar em projeções quando a leitura solicitar uma data limite.

Transactions deletadas não afetam saldo atual nem projeções.

## Snapshot

Snapshots de saldo podem virar uma otimização futura se o sistema escalar. Na V0, o saldo é derivado e não armazenado.

## Saldo Negativo

Saldo negativo ainda é uma questão aberta de produto. Veja [Open questions](../reference/open-questions.md).
