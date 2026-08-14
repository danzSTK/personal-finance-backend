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

O backend não envia senhas acima de 72 bytes UTF-8 ao bcrypt. Para não revelar
detalhes da política durante autenticação, excesso de bytes recebe o mesmo
`401 Invalid credentials` das outras credenciais inválidas. Veja o
[contrato de senhas locais](./passwords.md).

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
