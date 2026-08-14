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

- Mudança de senha e bloqueio possuem handlers próprios em notifications.
- Cada handler cria uma intenção idempotente e propaga falhas para retry da
  outbox.
- Eventos locais que chegaram a `DEAD` antes da existência desses handlers não
  recebem backfill ou replay retroativo.
