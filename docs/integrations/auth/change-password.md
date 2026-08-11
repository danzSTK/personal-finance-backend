---
area: auth
type: integration
status: current
related:
  - ./README.md
  - ../errors.md
  - ../../auth/change-password/index.md
---

# 🔑 POST /auth/password/change

Altera a senha local do usuário autenticado. Em caso de sucesso, todas as
sessões são revogadas e os cookies de autenticação são expirados; o frontend
deve encerrar o estado autenticado e pedir um novo login.

## Autenticação

- Cookie HttpOnly `accessToken`.
- Enviar a requisição com `credentials: 'include'` ou `withCredentials: true`.
- Não enviar `userId`, token ou identificador de sessão no body.

## Request

```http
POST /auth/password/change
Content-Type: application/json
```

```json
{
  "currentPassword": "senha-atual",
  "newPassword": "nova-senha"
}
```

As duas senhas devem ser strings entre 6 e 50 caracteres. Campos adicionais
são rejeitados.

## Success (`200`)

```json
{
  "object": "auth.password_change",
  "status": "CHANGED"
}
```

A resposta contém dois headers `Set-Cookie` que expiram `accessToken` e
`refreshToken`. A revogação vale para todas as sessões, não somente para o
dispositivo atual. Não tente executar refresh depois desse sucesso.

O e-mail de segurança é assíncrono. O `200` confirma a alteração da senha e a
revogação lógica das sessões, mas não confirma a entrega do e-mail.

## Erros esperados

|  HTTP | `code`                                    | Ação sugerida no frontend                                        |
| ----: | ----------------------------------------- | ---------------------------------------------------------------- |
| `400` | `VALIDATION_ERROR`                        | Exibir validação dos campos; não repetir automaticamente         |
| `400` | `NEW_PASSWORD_MUST_DIFFER`                | Pedir uma nova senha diferente da atual                          |
| `401` | `INVALID_ACCESS_TOKEN` ou `UNAUTHORIZED`  | Seguir o fluxo global de sessão inválida                         |
| `403` | `CURRENT_PASSWORD_INVALID`                | Marcar a senha atual como incorreta                              |
| `403` | `EMAIL_VERIFICATION_REQUIRED`             | Direcionar ao fluxo de verificação de e-mail                     |
| `409` | `PASSWORD_CHANGE_EMAIL_PROVIDER_REQUIRED` | Informar que a conta não possui senha local                      |
| `429` | `PASSWORD_CHANGE_BLOCKED`                 | Desabilitar nova tentativa até o `retryAfterSeconds`             |
| `429` | `PASSWORD_CHANGE_COOLDOWN_ACTIVE`         | Exibir o cooldown e aguardar                                     |
| `429` | `PASSWORD_CHANGE_DAILY_LIMIT_EXCEEDED`    | Informar que o limite temporário foi atingido                    |
| `429` | `PASSWORD_CHANGE_OPERATION_PENDING`       | Impedir duplo envio e tentar novamente após o tempo informado    |
| `429` | `PASSWORD_CHANGE_COST_LIMITED`            | Interromper repetição automática e respeitar o tempo informado   |
| `503` | `PASSWORD_CHANGE_STATE_UNAVAILABLE`       | Exibir indisponibilidade temporária; não assumir que houve troca |

O backend não retorna quantas tentativas restam.

### Contrato de retry

Todo erro temporário da feature retorna o mesmo número inteiro em:

- header HTTP `Retry-After`, em segundos;
- `details.retryAfterSeconds`, no body.

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 61
```

```json
{
  "statusCode": 429,
  "code": "PASSWORD_CHANGE_BLOCKED",
  "message": "Password change is temporarily blocked.",
  "path": "/auth/password/change",
  "timestamp": "2026-08-11T12:00:00.000Z",
  "details": {
    "retryAfterSeconds": 61
  }
}
```

Use `code` para decidir a interface e trate `message` apenas como fallback. O
header `Retry-After` é exposto pelo CORS; o body permite o mesmo tratamento em
clientes que não leem headers.

## Exemplo com `fetch`

```ts
const response = await fetch(`${apiUrl}/auth/password/change`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ currentPassword, newPassword }),
});

const payload = await response.json();

if (response.ok && payload.object === "auth.password_change") {
  clearAuthenticatedUser();
  navigateToSignIn();
  return;
}

if (response.status === 429) {
  const retryAfterSeconds = Number(
    response.headers.get("Retry-After") ?? payload.details?.retryAfterSeconds,
  );

  disablePasswordChangeUntil(retryAfterSeconds);
}
```

Os nomes `clearAuthenticatedUser`, `navigateToSignIn` e
`disablePasswordChangeUntil` representam funções do frontend; não são exports do
backend.
