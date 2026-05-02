---
area: accounts
type: flow
status: planned
related:
  - ../decisions/delete-only-without-movement.md
  - ./archive-account.md
---

# Delete Account

Delete de account ainda não está implementado.

## Regra Planejada

Permitir delete somente quando a account nunca teve:

- transação;
- agendamento;
- transferência;
- qualquer vínculo financeiro.

Após qualquer movimentação ou vínculo financeiro, a account não pode ser deletada. O caminho passa a ser arquivar.

## Motivação

Permitir apagar erro de criação recente sem comprometer integridade histórica.
