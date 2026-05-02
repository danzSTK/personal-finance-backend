---
area: auth
type: flow
status: current
endpoint: POST /auth/refresh
related:
  - ../concepts/refresh-token.md
  - ../concepts/session-state.md
  - ../decisions/stateful-refresh-token-in-redis.md
  - ../../integrations/auth/refresh-tokens.md
---

# Refresh Token Rotation

Renova a sessão usando o cookie `refreshToken`.

## Fluxo

1. `JwtRefreshGuard` valida assinatura e expiração do refresh token.
2. Confere se a sessão `userId + jti` existe no Redis.
3. Remove a sessão antiga.
4. Gera novo access token.
5. Gera novo refresh token.
6. Registra nova sessão no Redis.
7. Atualiza cookies HttpOnly.

## Proteção Contra Replay

Se o refresh token é criptograficamente válido, mas o `jti` não existe no Redis, o sistema revoga todas as sessões do usuário e retorna `401 Unauthorized`.
