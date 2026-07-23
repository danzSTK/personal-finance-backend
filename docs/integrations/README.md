---
area: integrations
type: index
status: current
last_reviewed: 2026-07-23
related:
  - ../architecture.md
  - ../auth/README.md
  - ../platform/response-objects.md
---

# Guia de integração — Danfy API

## Base URL

- Development: `http://localhost:3000`
- Production: `https://api.danfy.app`

## Modelo de autenticação (cookie-based)

A API usa cookies HttpOnly para sessão:

- `accessToken` (curta duração) em cookie HttpOnly (`Path=/`)
- `refreshToken` (longa duração) em cookie HttpOnly (`Path=/auth`)

O cliente **não** deve armazenar token em `localStorage` nem enviar `Authorization: Bearer`.
Use sempre:

- `credentials: 'include'` no `fetch`
- `withCredentials: true` no `axios`

## Exemplo rápido

```bash
# Sign in (salva cookies)
curl -X POST http://localhost:3000/auth/sign-in \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"user@example.com","password":"<strong-password>"}'

# Rota autenticada usando cookie
curl -X GET http://localhost:3000/users/me \
  -b cookies.txt
```

## CSRF / Origin check

Para métodos mutáveis, configure `CSRF_ALLOWED_ORIGINS` com as origens do frontend e, se usar Swagger em `/docs`, inclua também a origem da API (`APP_URL`).

## Módulos

- [Date and time contract](./date-and-time.md)
- [Error contract](./errors.md)
- [Response objects](./response-objects.md)
- [Auth integration](./auth/README.md)
- [Auth architecture](../auth/README.md)
- [Users integration](./users/README.md)
- [Users architecture](../users/README.md)
- [Accounts integration](./accounts/README.md)
- [Accounts architecture](../accounts/README.md)
- [Categories integration](./categories/README.md)
- [Categories architecture](../categories/README.md)
- [Transactions integration](./transactions/README.md)
- [Transactions architecture](../transactions/README.md)
