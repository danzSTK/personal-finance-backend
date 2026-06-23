---
area: auth
type: flow
status: current
endpoint: POST /auth/sign-in
related:
  - ../concepts/cookie-based-auth.md
  - ../concepts/session-state.md
  - ../../integrations/auth/sign-in.md
---

# Sign-In

Login por e-mail e senha.

## Fluxo

1. `LocalAuthGuard` usa `LocalStrategy`.
2. `ValidateCredentialsUseCase` valida usuário por e-mail.
3. Verifica existência do provider `EMAIL`.
4. Valida senha.
5. Verifica que o usuário não está bloqueado.
6. `SignInUseCase` gera novo par de tokens.
7. Cria sessão no Redis.
8. Seta cookies HttpOnly.
9. Retorna perfil do usuário.

Falha de credenciais retorna `401 Unauthorized`.
