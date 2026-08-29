# 🔗 Link de providers

## POST /auth/providers/link/email

Adiciona uma senha ao e-mail principal de uma conta já autenticada.

- Auth: cookie `accessToken` (HttpOnly)
- `Content-Type: application/json`
- Status: `200`

```json
{
  "password": "<strong-password>"
}
```

Durante uma versão de transição, o campo opcional `email` ainda é aceito, está
depreciado e é ignorado integralmente. Mesmo que seja diferente, inválido ou
nulo, o vínculo sempre usa o e-mail principal persistido da conta. Outros campos
extras continuam rejeitados.

`password` deve ter entre 6 e 50 caracteres e no máximo 72 bytes UTF-8. Excesso
de bytes retorna `400 VALIDATION_ERROR` associado ao campo. Veja o
[contrato de senhas locais](./passwords.md).

```bash
curl -X POST http://localhost:3000/auth/providers/link/email \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"password":"<strong-password>"}'
```

Resposta:

```json
{
  "object": "auth_provider.email_link",
  "message": "Email provider linked successfully"
}
```

O vínculo não altera o e-mail principal, status ou sessões e não dispara uma
nova verificação de e-mail.

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
