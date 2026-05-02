---
area: auth
type: flow
status: current
endpoint: POST /auth/logout
related:
  - ../concepts/access-token.md
  - ../concepts/session-state.md
  - ../../integrations/auth/logout.md
---

# Logout

Encerra a sessão atual.

## Fluxo

1. Requer access token e refresh token via cookies HttpOnly.
2. Decodifica access token para obter `jti` e TTL restante.
3. Verifica refresh token, mesmo expirado, para extrair `jti`.
4. Adiciona `jti` do access token na blacklist com TTL restante.
5. Revoga sessão do refresh token no Redis.
6. Limpa cookies de sessão.

## Resultado

O access token deixa de ser aceito imediatamente por blacklist, e o refresh token perde a sessão stateful.
