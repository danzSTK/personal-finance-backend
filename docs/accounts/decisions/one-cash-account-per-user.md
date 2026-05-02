---
area: accounts
type: decision
status: planned
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

## Consequência

O sistema deve bloquear criação manual de segunda `CASH`.
