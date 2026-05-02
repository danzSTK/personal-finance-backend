---
area: auth
type: flow
status: current
endpoint: POST /auth/providers/link/email
related:
  - ../concepts/auth-provider.md
  - ../decisions/no-automatic-provider-link.md
  - ../../integrations/auth/link-providers.md
---

# Link EMAIL Provider

Vincula credenciais de e-mail e senha a um usuário já autenticado.

## Fluxo

1. Recebe `email` e `password`.
2. Verifica se já existe provider `EMAIL` com aquele e-mail.
3. Carrega usuário autenticado.
4. Impede vínculo duplicado caso o usuário já tenha provider `EMAIL`.
5. Adiciona provider no domínio.
6. Persiste em transação.

## Erros

- Provider já usado: `409 Conflict`.
- Usuário já tem provider `EMAIL`: `409 Conflict`.
