# 🔐 Auth - Overview

Este módulo usa autenticação baseada em **cookies HttpOnly**.

## Fluxo padrão

1. `POST /auth/sign-in` ou `POST /auth/sign-up` cria sessão e define cookies.
2. Endpoints protegidos (`/users/me`, `/auth/sessions`, etc.) leem `accessToken` do cookie.
3. Em `401`, cliente chama `POST /auth/refresh` com cookies.
4. `POST /auth/logout` invalida sessão e limpa cookies.

## Regras importantes

- Não enviar `Authorization: Bearer`.
- Não salvar access token em storage do browser.
- Sempre usar `credentials: 'include'` / `withCredentials: true`.

## Endpoints

- [POST /auth/sign-up](./sign-up.md)
- [POST /auth/sign-in](./sign-in.md)
- [GET /auth/google](./oauth-google.md)
- [POST /auth/refresh](./refresh-tokens.md)
- [POST /auth/logout](./logout.md)
- [GET /users/me](./get-me.md)
- [GET/DELETE /auth/sessions](./sessions.md)
- [Link providers](./link-providers.md)
