---
area: accounts
type: flow
status: planned
related:
  - ../concepts/cash-account.md
  - ../decisions/cash-account-created-on-onboarding.md
  - ../decisions/one-cash-account-per-user.md
  - ../../events/README.md
  - ../../events/user-created.md
---

# Onboarding CASH Account

A primeira account do usuário é criada automaticamente depois que um novo acesso/usuário é criado com sucesso.

O fluxo usa o padrão de eventos com outbox da plataforma. Para o desenho geral, veja [Events flow](../../Excalidraw/Events-flow.excalidraw.md). Para o padrão técnico, veja [Events architecture](../../events/README.md). O evento de entrada é [user.created](../../events/user-created.md).

## Regra Planejada

Ao criar um novo acesso/usuário, o sistema deve criar automaticamente uma account `CASH`.

Essa account:

- pertence ao usuário criado;
- é única;
- existe para garantir uma account estrutural mínima;
- não pode ser criada manualmente depois.
- é a primeira e default do usuário;
- é criada com nome `Carteira`, `initialBalanceCents` `0` e `includeInTotal=true`.

No onboarding, essa account já deve existir. Se futuramente coletarmos dados de personalização, eles devem atualizar os defaults; o sistema não deve bloquear o uso se o usuário não responder essa etapa.
