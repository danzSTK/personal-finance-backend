---
area: auth
type: flow
status: current
related:
  - ../concepts/session-state.md
  - ../reference/redis-keys.md
  - ../../integrations/auth/sessions.md
---

# Sessões Ativas

Permite listar e revogar sessões do usuário autenticado.

## GET /auth/sessions

Retorna sessões ativas com metadata:

- `jti`;
- browser;
- sistema operacional;
- dispositivo;
- IP;
- localização;
- `loginAt`.

## DELETE /auth/sessions/:jti

Revoga uma sessão específica.

Se o `jti` não existir para o usuário, retorna `404 Not Found`.
