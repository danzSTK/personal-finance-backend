---
area: transactions
type: concept
status: draft
related:
  - ./transaction.md
  - ../decisions/transaction-amount-is-positive.md
---

# Transaction Amount

Transaction amount representa o valor monetário do lançamento.

## Regra Planejada

O valor informado em uma transaction deve ser sempre positivo.

O tipo da transaction define se o valor entra, sai, movimenta internamente ou corrige saldo.

## Motivo

Guardar valores sempre positivos reduz ambiguidade nos cálculos e evita combinações confusas como despesa com valor negativo ou receita com valor negativo.

## Schema Atual

O schema atual já protege essa regra com constraint `amount > 0`.
