---
area: accounts
type: concept
status: current
related:
  - ./account-type.md
  - ./default-account.md
  - ./archived-account.md
---

# Account

Uma account representa um lugar lógico onde o usuário acompanha dinheiro.

Campos principais:

- `userId`: dono da account.
- `name`: nome exibido ao usuário.
- `type`: tipo da account.
- `initialBalanceCents`: saldo inicial usado no cálculo derivado.
- `color` e `icon`: customização visual.
- `includeInTotal`: define se entra nos totais agregados.
- `isArchived`: remove a account da listagem padrão.
- `isDefault`: account padrão do usuário.

## Segurança

Todo acesso a account deve ser filtrado por `userId` do usuário autenticado. O `userId` nunca deve vir do body.

## Regra Central

O usuário deve sempre ter pelo menos uma account ativa no sistema.
