---
area: accounts
type: decision
status: planned
related:
  - ../flows/transfer-between-accounts.md
  - ../concepts/account-balance.md
---

# Transferências São Neutras

## Decisão

Transferências entre accounts do próprio usuário não contam como receita nem despesa.

## Motivos

- Não alteram patrimônio total do usuário.
- Representam deslocamento interno de saldo.
- Podem aparecer em relatórios, mas não em resultado financeiro.

## Regra Técnica

Transferências devem ser atômicas.
