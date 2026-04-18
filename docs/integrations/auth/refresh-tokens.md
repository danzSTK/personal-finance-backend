# 🔄 POST /auth/refresh

Renova a sessão usando `refreshToken` cookie (HttpOnly) e rotaciona tokens.

## Request

```http
POST /auth/refresh
```

Sem body. O cookie é enviado automaticamente.

## Success (`200`)

- `Set-Cookie: accessToken=...` (novo)
- `Set-Cookie: refreshToken=...` (novo)
- Body:

```json
{
  "message": "Tokens refreshed successfully"
}
```

## Frontend

Em erro `401` de rota protegida, chame refresh e repita a request original:

```ts
await axios.post('/auth/refresh', {}, { withCredentials: true });
```

Sem ler token do response, sem `localStorage`, sem header Bearer.
