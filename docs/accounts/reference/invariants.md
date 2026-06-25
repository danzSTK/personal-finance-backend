---
area: accounts
type: reference
status: current
related:
  - ../concepts/account.md
  - ../concepts/cash-account.md
  - ../concepts/default-account.md
---

# Invariants

## Atuais

- Dado de account sempre pertence a um `userId`.
- Controller usa `@CurrentUser()`; `userId` não vem do body.
- Account default não pode ser arquivada.
- Account arquivada não pode virar default.
- Usuário precisa manter pelo menos uma account ativa.
- Accounts arquivadas não aparecem por padrão.
- `includeInTotal=false` remove a account dos totais agregados e relatórios gerais.
- Accounts fora dos totais ainda podem aparecer quando pedidas explicitamente.

## Planejadas

- Usuário terá exatamente uma `CASH`.
- `CASH` será criada no onboarding.
- `CASH` não poderá ser arquivada, deletada, duplicada nem trocar de tipo.
- Delete só será permitido sem qualquer movimentação ou vínculo financeiro.
- Saldo será sempre derivado do histórico.
- Transferências entre accounts serão neutras e atômicas.
- `initialBalanceCents` será editável apenas antes da primeira movimentação ou vínculo financeiro.
