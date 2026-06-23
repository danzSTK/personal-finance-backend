---
area: transactions
type: decision
status: draft
related:
  - ../concepts/transaction-type.md
  - ../../accounts/decisions/transfers-are-neutral.md
  - ../../accounts/flows/transfer-between-accounts.md
---

# Transfers Are Neutral

## Decisão

Transferências entre accounts do próprio usuário não contam como receita nem despesa.

## Motivos

- Não alteram o total financeiro do usuário.
- Representam deslocamento interno entre accounts.
- Não devem entrar em relatórios comuns de receita ou despesa.

## Relação Com Accounts

A regra principal de transferência pertence ao fluxo entre accounts.

Este arquivo registra apenas como transactions devem respeitar essa decisão no histórico financeiro.

## Regra Técnica

Uma transferência deve ser registrada de forma atômica e manter vínculo claro entre origem e destino.

A modelagem final ainda será validada antes da implementação.
