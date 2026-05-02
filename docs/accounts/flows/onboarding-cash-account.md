---
area: accounts
type: flow
status: planned
related:
  - ../concepts/cash-account.md
  - ../decisions/cash-account-created-on-onboarding.md
  - ../decisions/one-cash-account-per-user.md
---

# Onboarding CASH Account

Fluxo ainda não implementado.

## Regra Planejada

Ao criar um novo acesso/usuário, o sistema deve criar automaticamente uma account `CASH`.

Essa account:

- pertence ao usuário criado;
- é única;
- existe para garantir uma account estrutural mínima;
- não pode ser criada manualmente depois.

## Pergunta De Implementação

Definir em qual use case de onboarding/cadastro a criação será acoplada e se precisa acontecer na mesma transação do usuário.
