---
area: auth
type: concept
status: current
related:
  - ./access-token.md
  - ./refresh-token.md
  - ../decisions/use-http-only-cookies.md
---

# Cookie-Based Auth

O módulo `auth` usa autenticação baseada em cookies HttpOnly.

Cookies principais:

- `accessToken`: cookie HttpOnly com `Path=/`.
- `refreshToken`: cookie HttpOnly com `Path=/auth`.

Regras para clientes:

- Não enviar `Authorization: Bearer`.
- Não armazenar tokens em `localStorage` ou `sessionStorage`.
- Usar `credentials: 'include'` no `fetch`.
- Usar `withCredentials: true` no Axios.

Veja também a documentação de integração em [Auth integration](../../integrations/auth/README.md).
