---
area: accounts
type: flow
status: planned
related:
  - ../decisions/transfers-are-neutral.md
  - ../concepts/account-balance.md
---

# Transfer Between Accounts

Transferência entre accounts do mesmo usuário ainda não está implementada.

## Regra Planejada

Uma transferência entre contas do próprio usuário:

- não é receita;
- não é despesa;
- é neutra para resultado financeiro;
- pode aparecer em relatórios financeiros como movimentação;
- deve ser 100% atômica.

## Segurança

As duas accounts envolvidas precisam pertencer ao usuário autenticado.
