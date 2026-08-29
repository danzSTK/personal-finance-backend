---
area: auth
type: concept
status: current
related:
  - ../flows/link-email-provider.md
  - ../flows/link-google-provider.md
  - ../decisions/no-automatic-provider-link.md
---

# Auth Provider

O usuário pode possuir múltiplos provedores de autenticação.

Provedores suportados:

- `EMAIL`: credenciais por senha para o e-mail principal de `users.email`.
- `GOOGLE`: OAuth 2.0 com Google.

As regras de vínculo vivem no domínio de usuário:

- `User.addAuthProvider`;
- `User.hasAuthProvider`;
- `User.getCredentialsAuthProvider`.

O cadastro por credenciais não vincula automaticamente uma conta existente. Vínculos entre providers acontecem por fluxos explícitos em `/auth/providers/link/*`.

O provider `EMAIL` não cria uma identidade alternativa: seu `provider_user_id`
deve ser igual ao e-mail principal da conta. Troca de e-mail pertence a um fluxo
centralizado futuro.
