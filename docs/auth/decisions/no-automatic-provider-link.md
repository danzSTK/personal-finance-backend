---
area: auth
type: decision
status: current
related:
  - ../concepts/auth-provider.md
  - ../flows/sign-up.md
  - ../flows/link-email-provider.md
---

# Não Vincular Providers Automaticamente

## Decisão

Cadastro por credenciais não vincula conta existente automaticamente.

Se o e-mail já existir, `POST /auth/sign-up` retorna `409 Conflict`.

## Motivos

- Evita vínculo implícito de identidades.
- Torna o consentimento do usuário explícito.
- Centraliza vínculo em rotas dedicadas.

## Fluxos Dedicados

- [Link EMAIL provider](../flows/link-email-provider.md)
- [Link GOOGLE provider](../flows/link-google-provider.md)
