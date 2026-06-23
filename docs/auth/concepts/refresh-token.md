---
area: auth
type: concept
status: current
related:
  - ./session-state.md
  - ../flows/refresh-token-rotation.md
  - ../decisions/stateful-refresh-token-in-redis.md
---

# Refresh Token

O refresh token é um JWT de vida mais longa usado para renovar a sessão.

Características:

- Assinado com secret diferente do access token.
- Enviado em cookie HttpOnly `refreshToken`.
- Persistido no Redis como sessão stateful.
- Identificado por `jti`.

A existência do refresh token no Redis define se a sessão ainda está ativa.

Se um refresh token válido criptograficamente não existir mais no Redis, o sistema trata como possível replay/hijacking e revoga todas as sessões do usuário.
