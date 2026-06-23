---
area: transactions
type: flow
status: planned
endpoint: PATCH /transactions/:id/archive
related:
  - ../concepts/transaction.md
  - ../reference/invariants.md
---

# Archive Transaction

Arquiva ou inativa uma transaction conforme a decisão final do domínio.

## Estado

Este fluxo ainda não deve antecipar detalhes de implementação.

A documentação do fluxo deve ser preenchida quando o caso de uso for implementado.

Quem implementar o fluxo deve documentar:

- diferença entre archive, deactivate e delete;
- validações executadas;
- impacto no histórico financeiro;
- impacto em saldo e relatórios;
- erros possíveis;
- resposta esperada.

## Regras Já Definidas

A implementação deve respeitar os conceitos, decisões e invariants já documentados em transactions.
