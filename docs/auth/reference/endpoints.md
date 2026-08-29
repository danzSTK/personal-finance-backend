---
area: auth
type: reference
status: current
related:
  - ../../integrations/auth/README.md
---

# Endpoints Auth

| Método   | Rota                                     | Auth                                     | Descrição                                                   |
| -------- | ---------------------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `GET`    | `/users/me`                              | `JwtAuthGuard`                           | Retorna dados do usuário autenticado                        |
| `POST`   | `/auth/sign-up`                          | público                                  | Cadastro por e-mail/senha                                   |
| `POST`   | `/auth/sign-in`                          | `LocalAuthGuard`                         | Login por e-mail/senha                                      |
| `GET`    | `/auth/google`                           | `GoogleAuthGuard`                        | Inicia login social com Google                              |
| `GET`    | `/auth/google/callback`                  | `GoogleAuthGuard`                        | Callback OAuth Google                                       |
| `POST`   | `/auth/refresh`                          | `JwtRefreshGuard`                        | Rotaciona tokens                                            |
| `POST`   | `/auth/logout`                           | `JwtAuthGuard`                           | Logout da sessão atual                                      |
| `POST`   | `/auth/email-verification/confirm`       | público                                  | Confirma e-mail por token                                   |
| `POST`   | `/auth/email-verification/resend`        | `JwtAuthGuard`                           | Reenvia e-mail de verificação para usuário autenticado      |
| `GET`    | `/auth/email-verification/resend/status` | `JwtAuthGuard`                           | Consulta disponibilidade, contador e espera do reenvio      |
| `GET`    | `/auth/sessions`                         | `JwtAuthGuard`                           | Lista sessões ativas                                        |
| `DELETE` | `/auth/sessions/:jti`                    | `JwtAuthGuard`                           | Revoga sessão específica                                    |
| `POST`   | `/auth/providers/link/email`             | `JwtAuthGuard`                           | Adiciona senha ao e-mail principal e vincula provider EMAIL |
| `GET`    | `/auth/password/change/status`           | `JwtAuthGuard`                           | Informa disponibilidade temporal da alteração de senha      |
| `POST`   | `/auth/password/change`                  | `JwtAuthGuard + PasswordChangeCostGuard` | Confirma e altera a senha local, revogando todas as sessões |
| `GET`    | `/auth/providers/link/google`            | `JwtAuthGuard + GoogleLinkInitAuthGuard` | Inicia vínculo Google                                       |
| `GET`    | `/auth/providers/link/google/callback`   | `GoogleLinkAuthGuard`                    | Callback do vínculo Google                                  |
