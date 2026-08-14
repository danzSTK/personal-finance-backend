---
area: auth
type: decision
status: current
related:
  - ../flow/failed-attempts.md
  - ./pure-policy-longest-retry.md
---

# Fatos persistidos e restrições derivadas

## Decisão

Persistir somente `CURRENT_PASSWORD_FAILED`, `PASSWORD_CHANGED` e
`FAILED_ATTEMPTS_BLOCK_STARTED`. Não criar um tipo genérico
`OPERATION_BLOCKED`.

## Motivos

- Falha, alteração e início de bloqueio são fatos auditáveis.
- Cooldown e limite diário são decisões derivadas de `PASSWORD_CHANGED`.
- Um evento genérico misturaria causas diferentes e duplicaria estado.

## Consequências

- A policy recalcula cooldown e limite a partir do histórico.
- Somente bloqueios por falhas possuem `blockedUntil` persistido.
- O histórico permanece pequeno e semanticamente explícito.
