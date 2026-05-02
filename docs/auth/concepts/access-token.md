---
area: auth
type: concept
status: current
related:
  - ./cookie-based-auth.md
  - ./session-state.md
  - ../reference/redis-keys.md
---

# Access Token

O access token é um JWT de curta duração usado para autenticar rotas protegidas.

## Payload

Inclui:

- `jti`: identificador único do token.
- `sub`: id do usuário.
- `email`: e-mail do usuário.
- `status`: status atual do usuário.

## Validação

O token é validado no `JwtStrategy`.

Mesmo sendo JWT, ele pode ser invalidado antes da expiração natural por blacklist no Redis. Isso acontece, por exemplo, no [logout](../flows/logout.md).
