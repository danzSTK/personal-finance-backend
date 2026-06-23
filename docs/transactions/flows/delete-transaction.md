---
area: transactions
type: flow
status: planned
endpoint: DELETE /transactions/:id
related:
  - ../concepts/transaction-deletion.md
  - ../decisions/transactions-can-be-deleted.md
  - ../reference/invariants.md
---

# Delete Transaction

Remove uma transaction do histórico ativo do usuário, quando a regra de domínio permitir.

## Estado

Este fluxo ainda não deve antecipar detalhes de implementação.

A documentação do fluxo deve ser preenchida quando o caso de uso for implementado.

Quem implementar o fluxo deve documentar:

- entrada esperada;
- validações executadas;
- bloqueio de delete para `TRANSFER`;
- comportamento para `PENDING`;
- comportamento para `EFFECTIVE`;
- impacto em saldo atual;
- impacto em saldo previsto;
- impacto em relatórios;
- estratégia interna de persistência;
- erros possíveis;
- resposta esperada.

## Regras Já Definidas

A implementação deve respeitar [Transaction deletion](../concepts/transaction-deletion.md), [Transactions can be deleted](../decisions/transactions-can-be-deleted.md) e os invariants do domínio.
