---
area: users
type: integration
status: current
---

# Users Integration

Este diretório descreve as rotas HTTP de perfil do usuário autenticado.

## Autenticação

As rotas de perfil usam o cookie HttpOnly `accessToken`. O frontend deve enviar requests com `credentials: 'include'` ou `withCredentials: true`.

O `userId` nunca deve ser enviado no body; o backend identifica o usuário pela sessão.

## Endpoints

- [GET /users/me](../auth/get-me.md) retorna o perfil autenticado com `avatarUrl` quando houver avatar pronto.
- [PATCH /users/me](./update-user-profile.md)
- [PUT /users/me/username](./update-username.md)
- [PUT /users/me/avatar](./update-user-avatar.md)
- [DELETE /users/me/avatar](./remove-user-avatar.md)

Username e email não são alterados por `PATCH /users/me`:

- username usa `PUT /users/me/username`, com disponibilidade, normalização e unicidade;
- email terá fluxo próprio de segurança, confirmação e providers de autenticação.

Contrato geral de erros: [Error contract](../errors.md).
