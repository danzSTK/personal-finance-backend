---
area: accounts
type: concept
status: planned
related:
  - ../decisions/cash-account-created-on-onboarding.md
  - ../decisions/one-cash-account-per-user.md
  - ./default-account.md
---

# CASH Account

`CASH` representa dinheiro físico/disponível.

## Regra Planejada Para V0

- Criada automaticamente no onboarding.
- Única por usuário.
- Não pode ser criada manualmente.
- Não pode ser arquivada.
- Não pode ser deletada.
- Não pode trocar de tipo.
- Pode alterar nome, cor, ícone e `includeInTotal`.

## Intenção

`CASH` é uma account estrutural do usuário. Ela serve como base para validações e fallback de transações não classificadas quando necessário.
