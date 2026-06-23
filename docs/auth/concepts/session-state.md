---
area: auth
type: concept
status: current
related:
  - ./refresh-token.md
  - ../reference/redis-keys.md
  - ../flows/sessions.md
---

# Sessão Stateful

Sessões são stateful no Redis.

Cada sessão é identificada pelo `jti` do refresh token. O Redis guarda:

- metadata da sessão;
- conjunto de sessões ativas do usuário;
- blacklist de access tokens encerrados antes do vencimento.

Metadata de sessão inclui informações como:

- browser;
- sistema operacional;
- dispositivo;
- IP;
- localização;
- data de login.

Esse desenho permite listar sessões, revogar uma sessão específica e invalidar todas as sessões quando houver suspeita de replay.
