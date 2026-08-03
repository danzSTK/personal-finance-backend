---
area: auth
type: decision
status: current
related:
  - ../redis-keys.md
  - ./full-projection-replacement.md
---

# PostgreSQL como autoridade e Redis como projeção

## Decisão

`password_change_events` registra os fatos duráveis. Redis mantém a projeção de
baixa latência usada para decidir bloqueio, cooldown e limite diário.

## Motivos

- Janelas e TTLs são eficientes no Redis.
- Perda, expiração ou recriação do cache não pode apagar o histórico de
  segurança.
- O PostgreSQL já participa da transação que altera a credencial.

## Consequências

- Uma projeção ausente é reconstruída a partir do PostgreSQL.
- Redis indisponível faz a operação falhar de forma fechada com `503`.
- O banco mantém auditoria e também permite recuperação do estado operacional.
