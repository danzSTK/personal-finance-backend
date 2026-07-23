---
area: transactions
type: flow
status: draft
related:
  - ../concepts/transaction-type.md
  - ../decisions/adjustments-are-technical-transactions.md
  - ../../accounts/concepts/account-balance.md
  - ../../categories/decisions/categories.md
---

# Balance Adjustment

Registra uma correção técnica de saldo por meio de transaction.

## Estado

Este fluxo ainda não deve antecipar detalhes de implementação.

A documentação do fluxo deve ser preenchida quando o caso de uso for implementado.

Quem implementar o fluxo deve documentar:

- entrada esperada;
- uso de `direction` exclusivo para `ADJUSTMENT`;
- category técnica usada;
- validações executadas;
- impacto no saldo atual;
- erros possíveis;
- resposta esperada.

## Regras Já Definidas

A implementação deve respeitar a decision [Adjustments are technical transactions](../decisions/adjustments-are-technical-transactions.md).
