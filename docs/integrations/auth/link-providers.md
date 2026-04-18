# 🔗 Link de providers

## POST /auth/providers/link/email

Vincula email/senha a uma conta já autenticada.

- Auth: cookie `accessToken` (HttpOnly)
- `Content-Type: application/json`
- Status: `200`

```json
{
  "email": "joao.silva@email.com",
  "password": "senhaSegura123"
}
```

```bash
curl -X POST http://localhost:3000/auth/providers/link/email \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"email":"joao.silva@email.com","password":"senhaSegura123"}'
```

## GET /auth/providers/link/google

Inicia fluxo OAuth para vincular Google à conta atual.

- Auth: cookie `accessToken` (HttpOnly)
- Status: `302` (redirect para Google)

## GET /auth/providers/link/google/callback

Callback do Google para concluir vínculo.

- Público (validação via `state`)
- Status: `302`
  - sucesso: `<frontend>/auth/link?success=google`
  - erro: `<frontend>/auth/link?error=<code>`
