---
area: auth
type: decision
status: current
related:
  - ../flow/failed-attempts.md
  - ./fifth-failure-starts-block.md
---

# Confirmar eventos de senha atual incorreta

## Decisão

A callback transacional retorna um resultado interno para senha incorreta ou
bloqueio iniciado. O use case lança o erro somente depois do commit.

## Motivos

- Lançar o erro dentro da callback faria rollback de
  `CURRENT_PASSWORD_FAILED`.
- Uma falha sem persistência permitiria tentativas ilimitadas.

## Consequências

- A auditoria é confirmada antes da resposta `403`.
- A quinta falha confirma também o início do bloqueio antes do `429`.
- Erros que realmente invalidam a transação continuam sendo propagados e
  causam rollback.
