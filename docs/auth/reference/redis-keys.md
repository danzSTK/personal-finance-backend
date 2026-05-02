---
area: auth
type: reference
status: current
related:
  - ../concepts/session-state.md
  - ../decisions/stateful-refresh-token-in-redis.md
---

# Redis Keys Auth

| Chave | Uso |
|---|---|
| `auth:rt:{userId}:{jti}` | Metadata da sessão do refresh token |
| `auth:sessions:{userId}` | Set com `jtis` ativos do usuário |
| `auth:blacklist:{jti}` | Blacklist de access tokens |
| `auth:google-link:{state}` | Estado temporário do fluxo de link Google |
