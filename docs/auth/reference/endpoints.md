---
area: auth
type: reference
status: current
related:
  - ../../integrations/auth/README.md
---

# Endpoints Auth

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/users/me` | `JwtAuthGuard` | Retorna dados do usuário autenticado |
| `POST` | `/auth/sign-up` | público | Cadastro por e-mail/senha |
| `POST` | `/auth/sign-in` | `LocalAuthGuard` | Login por e-mail/senha |
| `GET` | `/auth/google` | `GoogleAuthGuard` | Inicia login social com Google |
| `GET` | `/auth/google/callback` | `GoogleAuthGuard` | Callback OAuth Google |
| `POST` | `/auth/refresh` | `JwtRefreshGuard` | Rotaciona tokens |
| `POST` | `/auth/logout` | `JwtAuthGuard` | Logout da sessão atual |
| `POST` | `/auth/email-verification/confirm` | público | Confirma e-mail por token |
| `POST` | `/auth/email-verification/resend` | `JwtAuthGuard` | Reenvia e-mail de verificação para usuário autenticado |
| `GET` | `/auth/sessions` | `JwtAuthGuard` | Lista sessões ativas |
| `DELETE` | `/auth/sessions/:jti` | `JwtAuthGuard` | Revoga sessão específica |
| `POST` | `/auth/providers/link/email` | `JwtAuthGuard` | Vincula provider EMAIL |
| `GET` | `/auth/providers/link/google` | `JwtAuthGuard + GoogleLinkInitAuthGuard` | Inicia vínculo Google |
| `GET` | `/auth/providers/link/google/callback` | `GoogleLinkAuthGuard` | Callback do vínculo Google |
