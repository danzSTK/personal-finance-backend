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

Fórmula:

```text
initialBalance + receitas - despesas
```

## Regra

O saldo não deve ser persistido como coluna na account.

O `initialBalance` é a entrada inicial do cálculo. A regra planejada é permitir sua edição apenas enquanto a account não tiver movimentação; depois disso, correções devem acontecer via transações ou ajustes financeiros.

## Snapshot

Snapshots de saldo podem virar uma otimização futura se o sistema escalar. Na V0, o saldo é derivado e não armazenado.

## Saldo Negativo

Saldo negativo ainda é uma questão aberta de produto. Veja [Open questions](../reference/open-questions.md).
