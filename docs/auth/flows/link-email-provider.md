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

1. Recebe `password` e valida o máximo de 72 bytes UTF-8. O campo legado
   opcional `email` é aceito temporariamente e ignorado.
2. Carrega com lock o usuário identificado pela sessão autenticada.
3. Impede vínculo duplicado caso o usuário já tenha provider `EMAIL`.
4. Usa exclusivamente `users.email` como identificador do provider.
5. Verifica conflito com outro vínculo e adiciona o provider no domínio.
6. Persiste em transação e traduz corridas de unicidade para conflito estável.

O vínculo não altera o e-mail principal, status, sessões ou providers anteriores
e não dispara verificação de e-mail.

## Erros

- Provider já usado: `409 AUTH_PROVIDER_LINKED_TO_ANOTHER_USER`.
- Usuário já tem provider `EMAIL`: `409 AUTH_PROVIDER_ALREADY_LINKED`.
