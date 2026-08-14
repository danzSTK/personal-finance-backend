# 📝 POST /auth/sign-up

Cria conta, inicia sessão por cookies HttpOnly e dispara e-mail de verificação.

## Request

```http
POST /auth/sign-up
Content-Type: application/json
```

```json
{
  "userName": "john_doe",
  "email": "joao.silva@email.com",
  "password": "<strong-password>",
  "firstName": "João",
  "lastName": "Silva"
}
```

`password` deve ter entre 6 e 50 caracteres e no máximo 72 bytes UTF-8. Uma
entrada acima do limite retorna `400 VALIDATION_ERROR` associada ao campo. Veja
o [contrato de senhas locais](./passwords.md).

## Success (`201`)

- `Set-Cookie: accessToken=...; HttpOnly; Path=/; ...`
- `Set-Cookie: refreshToken=...; HttpOnly; Path=/auth; ...`
- Body: perfil do usuário (`UserProfileResponseDto`) com `status = PENDING_EMAIL_VERIFICATION`

## Frontend

Use `credentials: 'include'` / `withCredentials: true`.  
Não envie/guarde token manualmente no cliente.

Após o sign-up, leia `status`. Enquanto estiver `PENDING_EMAIL_VERIFICATION`, direcione o usuário para a experiência de confirmação de e-mail.
