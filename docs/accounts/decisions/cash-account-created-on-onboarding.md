---
area: accounts
type: decision
status: current
related:
  - ../concepts/cash-account.md
  - ../flows/onboarding-cash-account.md
---

# CASH Account Criada No Onboarding

## Decisão

Criar automaticamente uma account `CASH` no onboarding de um novo usuário/acesso.
Valores default são criados para atender os requisitos de um account somente para n impedirmos o  seu uso pelo Onboarding 

## Motivos

- Garantir que todo usuário tenha pelo menos uma account.
- Evitar que fluxos iniciais fiquem sem destino financeiro.
- Criar uma base estrutural para validações e fallback.

## Consequência

Usuário não deve criar `CASH` manualmente.
