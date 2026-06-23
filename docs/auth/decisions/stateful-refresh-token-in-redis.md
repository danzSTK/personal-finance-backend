---
area: auth
type: decision
status: current
related:
  - ../concepts/refresh-token.md
  - ../concepts/session-state.md
  - ../reference/redis-keys.md
---

# Refresh Token Stateful No Redis

## Decisão

Refresh tokens são JWTs, mas a sessão é validada no Redis.

## Motivos

- Permite revogação real.
- Permite listar sessões ativas.
- Permite detectar replay quando o token existe mas a sessão foi removida.

## Consequências

- Redis é dependência obrigatória do módulo auth.
- Refresh token precisa existir no Redis para ser aceito.
- Em suspeita de replay, todas as sessões do usuário são revogadas.
