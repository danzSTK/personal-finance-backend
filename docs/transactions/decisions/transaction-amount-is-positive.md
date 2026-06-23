---
area: transactions
type: decision
status: draft
related:
  - ../concepts/transaction-amount.md
  - ../reference/invariants.md
  - ../../database/schema.md
---

# Transaction Amount Is Positive

## Decisão

Toda transaction deve armazenar `amount` como valor positivo.

O sinal financeiro não deve vir de número negativo.

## Motivos

- Evita ambiguidade na leitura do histórico.
- Mantém consistência entre income, expense, transfer e adjustment.
- Simplifica validação de entrada.
- Alinha o domínio com a constraint atual do banco.

## Regra Técnica

A interpretação financeira deve vir do tipo da transaction e da categoria associada, não do sinal do `amount`.
