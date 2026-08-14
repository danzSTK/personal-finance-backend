---
area: auth
type: decision
status: current
related:
  - ../flow/README.md
  - ../redis-keys.md
---

# Barreira Redis e lock SQL

## Decisão

Adquirir `pending` com `SET NX PX` antes do bcrypt e usar
`pessimistic_write` na linha do usuário dentro da transação.

## Motivos

- A barreira reduz concorrência e comparações de hash duplicadas.
- O lock SQL continua sendo a autoridade final do hash e de
  `credentialVersion`.
- Uma proteção isolada não cobre ao mesmo tempo custo e consistência durável.

## Consequências

- Uma operação concorrente recebe `409` com retry.
- `mutationToken` identifica o dono e impede uma operação antiga de remover uma
  barreira nova.
- O TTL recupera o fluxo se o processo encerrar antes da liberação.
