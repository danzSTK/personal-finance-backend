# 🚪 POST /auth/logout

Encerra a sessão atual e limpa cookies de autenticação.

## Autenticação

Cookie HttpOnly (`accessToken` + `refreshToken`).  
Não use Bearer header.

## Request

```http
POST /auth/logout
```

Sem body.

## Success (`200`)

```json
{
  "message": "Logged out successfully"
}
```

`Set-Cookie` limpa os cookies de sessão.

## Frontend

```ts
await fetch('http://localhost:3000/auth/logout', {
  method: 'POST',
  credentials: 'include',
});
```
