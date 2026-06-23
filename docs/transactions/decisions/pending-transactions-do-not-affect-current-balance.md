---
area: transactions
type: decision
status: draft
related:
  - ../concepts/transaction-status.md
  - ../../accounts/concepts/account-balance.md
---

# Pending Transactions Do Not Affect Current Balance

## Decisão

Transactions pendentes não devem afetar o saldo atual da account.

Elas podem afetar projeções, pendências e saldos previstos, mas não o saldo real.

## Motivos

- Saldo atual deve representar apenas o que já aconteceu.
- Pendências podem mudar antes da confirmação.
- O usuário precisa diferenciar realidade financeira de previsão.

## Regra Técnica

O cálculo de saldo atual deve considerar apenas transactions efetivadas.

O cálculo de saldo previsto pode considerar transactions pendentes conforme a regra do produto.
