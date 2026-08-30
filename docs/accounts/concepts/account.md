---
area: accounts
type: concept
status: current
related:
  - ./account-type.md
  - ./default-account.md
  - ./archived-account.md
  - ./account-template.md
---

# Account

Uma account representa um lugar lógico onde o usuário acompanha dinheiro.

Campos principais:

- `userId`: dono da account.
- `name`: nome exibido ao usuário.
- `type`: tipo da account.
- `initialBalanceCents`: saldo inicial usado no cálculo derivado.
- `templateId`: referência à identidade visual da account.
- `color` e `icon`: shims legados temporários durante `DB-COMPAT-002`; não são a fonte nova de identidade.
- `includeInTotal`: define se entra nos totais agregados.
- `isArchived`: remove a account da listagem padrão.
- `isDefault`: account padrão do usuário.

## Segurança

Todo acesso a account deve ser filtrado por `userId` do usuário autenticado. O `userId` nunca deve vir do body.

## Regra Central

O usuário deve sempre ter pelo menos uma account ativa no sistema.

A imagem nova associa toda account criada a um `account_template`. `templateId` permanece nullable no banco apenas para que a v0.3 continue elegível para rollback e para que o reconciler alcance escritas legadas.
