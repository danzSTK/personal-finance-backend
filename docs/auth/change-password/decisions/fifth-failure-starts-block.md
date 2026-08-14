---
area: auth
type: decision
status: current
related:
  - ../flow/failed-attempts.md
  - ./commit-invalid-password-events.md
---

# Quinta falha inicia o bloqueio

## Decisão

A requisição que completa cinco falhas em 15 minutos persiste a falha, inicia o
bloqueio e responde `PASSWORD_CHANGE_BLOCKED`.

## Motivos

- Ao terminar essa requisição, a restrição já está ativa.
- Responder apenas senha incorreta ocultaria o tempo correto de retry.

## Consequências

- A quinta falha responde `429`, não `403`.
- O primeiro bloqueio dura uma hora.
- Um bloqueio reincidente iniciado em até 24 horas dura 24 horas.
