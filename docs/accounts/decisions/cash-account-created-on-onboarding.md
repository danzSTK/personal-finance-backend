---
area: accounts
type: decision
status: planned
related:
  - ../concepts/cash-account.md
  - ../flows/onboarding-cash-account.md
---

# CASH Account Criada No Onboarding

## Decisão

Criar automaticamente uma account `CASH` no onboarding de um novo usuário/acesso.

## Motivos

- Garantir que todo usuário tenha pelo menos uma account.
- Evitar que fluxos iniciais fiquem sem destino financeiro.
- Criar uma base estrutural para validações e fallback.

## Consequência

Usuário não deve criar `CASH` manualmente.
