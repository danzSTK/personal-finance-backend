---
area: transactions
type: flow
status: planned
endpoint: PATCH /transactions/:id/confirm
related:
  - ../concepts/transaction-status.md
  - ../concepts/transaction-date.md
  - ../decisions/pending-transactions-do-not-affect-current-balance.md
---

# Confirm Pending Transaction

Confirma uma transaction pendente como realizada.

## Estado

Este fluxo ainda não deve antecipar detalhes de implementação.

A documentação do fluxo deve ser preenchida quando o caso de uso for implementado.

Quem implementar o fluxo deve documentar:

- campos que podem ser ajustados na confirmação;
- preenchimento de `effectiveAt`;
- mudança de status;
- validações executadas;
- impacto no saldo atual;
- erros possíveis;
- resposta esperada.

## Regras Já Definidas

A implementação deve respeitar status, datas, amount positivo e demais decisions já documentadas em transactions.
