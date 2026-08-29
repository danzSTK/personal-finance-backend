---
area: auth
type: reference
status: current
related:
  - ../flows/link-google-provider.md
  - ../flows/refresh-token-rotation.md
---

# Erros e Redirects Auth

## HTTP

| Cenário                                                                         |                Status |
| ------------------------------------------------------------------------------- | --------------------: |
| DTO inválido                                                                    |                 `400` |
| Credenciais inválidas                                                           |                 `401` |
| Refresh token sem sessão Redis                                                  |                 `401` |
| E-mail ou username duplicado                                                    |                 `409` |
| Provider já vinculado ou em conflito                                            |                 `409` |
| E-mail pendente tentando acessar recurso bloqueado                              |                 `403` |
| Token de verificação inválido                                                   |                 `400` |
| Token de verificação expirado                                                   |                 `410` |
| Cooldown/limite/mutação concorrente do reenvio de verificação                   | `429` + `Retry-After` |
| Estado Redis do reenvio de verificação indisponível                             |                 `503` |
| Senha atual incorreta (`CURRENT_PASSWORD_INVALID`)                              |                 `403` |
| Provider local ausente (`PASSWORD_CHANGE_EMAIL_PROVIDER_REQUIRED`)              |                 `409` |
| Nova senha igual (`NEW_PASSWORD_MUST_DIFFER`)                                   |                 `400` |
| Bloqueio/cooldown/limite diário/mutação concorrente/custo                       | `429` + `Retry-After` |
| Estado Redis da alteração de senha indisponível                                 |                 `503` |
| Senha acima de 72 bytes em fluxo HTTP de criação/alteração (`VALIDATION_ERROR`) |                 `400` |

`PASSWORD_BYTE_LIMIT_EXCEEDED` é a defesa interna do serviço de hash. Nos
fluxos HTTP normais de criação e alteração, o DTO responde antes com
`VALIDATION_ERROR`; no login, a estratégia preserva o `401` genérico.

Respostas `429` da alteração de senha e do reenvio de verificação expõem o mesmo valor inteiro no header
`Retry-After` e em `details.retryAfterSeconds`.

No vínculo EMAIL, provider já existente na própria conta usa
`AUTH_PROVIDER_ALREADY_LINKED`; conflito com outra conta ou corrida da constraint
usa `AUTH_PROVIDER_LINKED_TO_ANOTHER_USER`.

## Link Google

Redirects do callback:

- Sucesso: `${FRONTEND_URL}/auth/link?success=google`
- Erro: `${FRONTEND_URL}/auth/link?error=<errorCode>`

Erros conhecidos:

- `missing_state`;
- `invalid_state`;
- `google_provider_conflict`.
