# 📝 POST /auth/sign-up

Cria conta e inicia sessão por cookies HttpOnly.

## Request

```http
POST /auth/sign-up
Content-Type: application/json
```

```json
{
  "userName": "john_doe",
  "email": "joao.silva@email.com",
  "password": "senhaSegura123",
  "firstName": "João",
  "lastName": "Silva"
}
```

## Success (`201`)

- `Set-Cookie: accessToken=...; HttpOnly; Path=/; ...`
- `Set-Cookie: refreshToken=...; HttpOnly; Path=/auth; ...`
- Body: perfil do usuário (`UserProfileResponseDto`)

## Frontend

Use `credentials: 'include'` / `withCredentials: true`.  
Não envie/guarde token manualmente no cliente.
