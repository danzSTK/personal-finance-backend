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

Bloqueios de cooldown, limite manual ou mutação concorrente retornam `429`. O
header `Retry-After` e `details.retryAfterSeconds` contêm o mesmo número inteiro
de segundos até a próxima tentativa.

Se o Redis não puder fornecer um estado válido antes da mutação, a API responde
`503 EMAIL_VERIFICATION_STATE_UNAVAILABLE` e não cria challenge nem intenção de
e-mail.

## Consultar Status Do Reenvio

O frontend pode fazer polling autenticado sem consumir o recurso:

```http
GET /auth/email-verification/resend/status
```

Disponível (`200`):

```json
{
  "object": "email_verification.resend_status.available",
  "status": "AVAILABLE",
  "available": true,
  "manualResendsUsed": 2,
  "manualResendsRemaining": 3,
  "manualResendLimit": 5,
  "windowSeconds": 86400,
  "lastLogicalSendAt": "2026-08-26T03:00:00.000Z"
}
```

Bloqueado (`200`):

```http
Retry-After: 91
Cache-Control: no-store
```

```json
{
  "object": "email_verification.resend_status.blocked",
  "status": "BLOCKED",
  "available": false,
  "blockedBy": "COOLDOWN",
  "retryAfterSeconds": 91,
  "manualResendsUsed": 2,
  "manualResendsRemaining": 3,
  "manualResendLimit": 5,
  "windowSeconds": 86400,
  "lastLogicalSendAt": "2026-08-26T03:00:00.000Z"
}
```

`blockedBy` pode ser `COOLDOWN`, `DAILY_LIMIT` ou `OPERATION_PENDING`. Quando
mais de uma restrição existe, `retryAfterSeconds` representa a maior espera.

Para usuário ativo (`200`):

```json
{
  "object": "email_verification.resend_status.already_verified",
  "status": "ALREADY_VERIFIED",
  "available": false
}
```

Todas as formas retornam `Cache-Control: no-store`. `Retry-After` aparece apenas
na forma bloqueada. Estado Redis indisponível ou inválido retorna
`503 EMAIL_VERIFICATION_STATE_UNAVAILABLE`.

## Regras

- Token expira em 15 minutos.
- O envio automático inicia cooldown de 60 segundos e não consome o limite manual.
- Cada resend manual confirmado aplica
  `min(60 * 2 ^ manualResendsUsed, 600)` segundos: 120, 240, 480, 600 e 600.
- O limite é de 5 resends manuais por usuário em uma janela móvel de 24 horas.
- A ausência das chaves Redis inicia um estado vazio; falha técnica do Redis não
  é tratada como ausência.
- O frontend deve extrair o token de `/verification-email?token=<token>` e confirmar via `POST`.

## Processamento Assíncrono

O `202 QUEUED` representa uma intenção persistida, não a confirmação de entrega pelo provider. A API grava `email_messages` e tenta adicionar o job; o envio é executado somente pelo worker.

Intenções de verificação possuem `deliver_before`, calculado cinco minutos antes
da expiração do token. Ao atingir esse prazo, o worker cancela a intenção sem
chamar o provider e encerra as tentativas restantes do BullMQ.

Se o PostgreSQL confirmar a intenção e o Redis BullMQ estiver indisponível, o
reconciliador do worker reenfileira mensagens `PENDING` ou `FAILED_RETRYABLE`
antigas. O frontend deve consultar o status antes de repetir o resend.
