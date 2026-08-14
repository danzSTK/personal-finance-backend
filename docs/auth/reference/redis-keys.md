---
area: auth
type: reference
status: current
related:
  - ../concepts/session-state.md
  - ../decisions/stateful-refresh-token-in-redis.md
  - ../change-password/redis-keys.md
---

# Redis Keys Auth

| Chave                                            | Tipo       | Uso                                                   |
| ------------------------------------------------ | ---------- | ----------------------------------------------------- |
| `auth:rt:{userId}:{jti}`                         | string     | Metadata da sessão do refresh token                   |
| `auth:sessions:{userId}`                         | set        | JTIs de refresh ativos do usuário                     |
| `auth:blacklist:{jti}`                           | string     | Blacklist pontual de access token                     |
| `auth:google-link:{state}`                       | string     | Estado temporário do link Google                      |
| `auth:password-change:{userId}:failures`         | sorted set | Falhas de senha atual na janela de 15 minutos         |
| `auth:password-change:{userId}:block`            | string     | Instante em milissegundos do fim do bloqueio ativo    |
| `auth:password-change:{userId}:block-recurrence` | string     | Início do bloqueio anterior na janela de reincidência |
| `auth:password-change:{userId}:changes`          | sorted set | Alterações concluídas na janela de 24 horas           |
| `auth:password-change:{userId}:initialized`      | string     | Confirma que a projeção Redis é utilizável            |
| `auth:password-change:{userId}:pending`          | string     | Barreira curta de mutação por usuário                 |
| `auth:password-change:cost:ip:{hmac}`            | string     | Contador técnico por fingerprint de IP                |
| `auth:password-change:cost:session:{hmac}`       | string     | Contador técnico por fingerprint de sessão            |

Nos nomes reais das seis chaves de estado, o `userId` aparece entre chaves
literais (`{...}`) como hash tag de Redis Cluster. A ausência de `initialized`
obriga a reconstrução por `password_change_events`; ela nunca é interpretada
como autorização. Todas as chaves possuem TTL derivado da janela que representam.

Conteúdo, TTLs e invariantes das chaves estão detalhados em
[Chaves Redis da alteração de senha](../change-password/redis-keys.md).
