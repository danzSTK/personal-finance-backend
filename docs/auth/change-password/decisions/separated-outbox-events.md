---
area: auth
type: decision
status: current
related:
  - ../flow/success.md
  - ./immediate-and-durable-reconciliation.md
  - ./credential-version-session-revocation.md
---

# Eventos de outbox separados por responsabilidade

## Decisão

Usar eventos distintos para reconstruir estado, revogar sessões e notificar
mudança ou bloqueio.

## Motivos

- Cada evento possui um consumidor e uma responsabilidade próprios.
- Dois eventos gerados pela mesma operação não significam dois e-mails.
- Reconciliação técnica não deve depender do módulo de notificações.

## Consequências

- Eventos sem handler falham e chegam a `DEAD` após o limite da outbox.
- Como a feature ainda está somente em ambiente local, a futura spec de e-mail
  não fará backfill ou replay retroativo desses registros.
- Mudança de senha e bloqueio já publicam os fatos necessários aos futuros
  handlers de notificação.
