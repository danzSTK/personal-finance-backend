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

| Cenário | Status |
|---|---:|
| DTO inválido | `400` |
| Credenciais inválidas | `401` |
| Refresh token sem sessão Redis | `401` |
| E-mail ou username duplicado | `409` |
| Provider já vinculado ou em conflito | `409` |

## Link Google

Redirects do callback:

- Sucesso: `${FRONTEND_URL}/auth/link?success=google`
- Erro: `${FRONTEND_URL}/auth/link?error=<errorCode>`

Erros conhecidos:

- `missing_state`;
- `invalid_state`;
- `google_provider_conflict`.
