# ✉️ Email verification

Confirma e-mail de contas criadas por credenciais.

Usuários com `status = PENDING_EMAIL_VERIFICATION` conseguem logar e chamar `GET /users/me`, mas recursos do produto retornam `403 EMAIL_VERIFICATION_REQUIRED` até a confirmação.

## Confirmar

```http
POST /auth/email-verification/confirm
Content-Type: application/json
```

```json
{
  "token": "token-completo-da-url"
}
```

Success (`200`):

```json
{
  "object": "email_verification.confirmation",
  "status": "VERIFIED"
}
```

## Reenviar

Requer sessão via cookies HttpOnly.

```http
POST /auth/email-verification/resend
```

Success (`202`):

```json
{
  "object": "email_verification.resend",
  "status": "QUEUED"
}
```

Se o e-mail já estiver verificado:

```json
{
  "object": "email_verification.resend",
  "status": "ALREADY_VERIFIED"
}
```

## Regras

- Token expira em 15 minutos.
- Reenvio tem cooldown de 60 minutos.
- O limite é 5 e-mails por e-mail em 24 horas, incluindo o envio automático inicial.
- O frontend deve extrair o token de `/verification-email?token=<token>` e confirmar via `POST`.
