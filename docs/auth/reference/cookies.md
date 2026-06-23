---
area: auth
type: reference
status: current
related:
  - ../concepts/cookie-based-auth.md
  - ../decisions/use-http-only-cookies.md
---

# Cookies Auth

| Cookie | Path | Uso |
|---|---|---|
| `accessToken` | `/` | Autenticar rotas protegidas |
| `refreshToken` | `/auth` | Renovar sessão e logout |

Ambos são HttpOnly.

Clientes devem enviar cookies automaticamente:

- `fetch`: `credentials: 'include'`;
- Axios: `withCredentials: true`.
