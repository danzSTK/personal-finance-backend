# 🔑 POST /auth/sign-in

Autentica usuário com email/senha e inicia sessão por cookies HttpOnly.

## Request

```http
POST /auth/sign-in
Content-Type: application/json
```

```json
{
  "email": "joao.silva@email.com",
  "password": "<strong-password>"
}
```

## Success (`200`)

- `Set-Cookie: accessToken=...; HttpOnly; Path=/; ...`
- `Set-Cookie: refreshToken=...; HttpOnly; Path=/auth; ...`
- Body: perfil do usuário autenticado (`UserProfileResponseDto`)

## Frontend

```ts
await fetch('http://localhost:3000/auth/sign-in', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ email, password }),
});
```

Não armazene token manualmente em `localStorage`.
