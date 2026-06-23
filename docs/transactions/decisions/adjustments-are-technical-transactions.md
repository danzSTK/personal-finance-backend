---
area: transactions
type: decision
status: draft
related:
  - ../concepts/transaction-type.md
  - ../../categories/decisions/categories.md
  - ../../accounts/concepts/account-balance.md
---

# Adjustments Are Technical Transactions

## Decisão

Ajustes de saldo devem ser tratados como transactions técnicas.

## Motivos

- Preservam histórico de correções.
- Evitam alterar `initialBalance` depois que a account já possui movimentação.
- Mantêm o saldo derivado do histórico.

## Relação Com Categories

A categoria técnica `ADJUSTMENT` já é prevista no domínio de categories.

Transactions de ajuste devem usar essa semântica quando a regra final for implementada.

## Regra Técnica

Um ajuste pode aumentar ou reduzir o saldo conforme a modelagem final definida para transactions técnicas.

Essa direção ainda precisa ser validada antes da implementação.
