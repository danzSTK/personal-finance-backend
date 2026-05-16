---
area: accounts
type: decision
status: current
related:
  - ../concepts/cash-account.md
  - ./cash-account-created-on-onboarding.md
---

# Uma CASH Account Por Usuário

## Decisão

Cada usuário terá exatamente uma account `CASH`.

## Motivos

- Simplifica validações.
- Evita ambiguidade sobre dinheiro físico/default estrutural.
- Mantém uma account mínima sempre disponível.
-  Ter um apoio para evitar duplicação no processo do default account

## Consequência

O sistema deve bloquear criação manual de segunda `CASH`.
