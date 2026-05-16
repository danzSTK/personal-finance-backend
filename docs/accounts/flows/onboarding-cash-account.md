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

A criação primeira conta do usuário é feita de forma automática no sistema a parti do momento que ele tem sucesso ao criar um acesso na plataforma. 
O fluxo inteiro acontece no padrão Events Outbox da plataforma para entender mais sobre como funciona esse fluxo e o que levamos em consideração pode ver o  [[Events-flow.excalidraw | Fluxo De eventos na plataforma]]  

TODO: Criar documentação de eventos na plataforma e referenciar aqui também

## Regra Planejada

Ao criar um novo acesso/usuário, o sistema deve criar automaticamente uma account `CASH`.

Essa account:

- pertence ao usuário criado;
- é única;
- existe para garantir uma account estrutural mínima;
- não pode ser criada manualmente depois.
- Ela é a primeira e default do usuário
- Atualmente ela por default vai ser criada com o Nome "Carteira" com o Initial Balance de 0 e inclusa no total. 

No Onboarding essa account já vai ser pré existente então vamos coletar os dados no onboarding somente para alterar os default o sistema n vai parar se ele não responder o onboarding da account 
