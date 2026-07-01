---
area: auth
type: flow
status: current
endpoint: POST /auth/sign-up
related:
  - ../concepts/auth-provider.md
  - ../concepts/cookie-based-auth.md
  - ../../integrations/auth/sign-up.md
---

# Sign-Up

Cadastro por credenciais.

## Fluxo

1. Validar `RegisterDto`.
2. Gerar hash da senha.
3. Verificar se já existe provider `EMAIL` para o e-mail.
4. Verificar se já existe usuário com o mesmo e-mail.
5. Verificar se `userName` já está em uso.
6. Criar `User` com status `PENDING_EMAIL_VERIFICATION` e provider `EMAIL`.
7. Gerar `accessToken` e `refreshToken`.
8. Criar sessão no Redis.
9. Setar cookies HttpOnly.
10. Retornar perfil do usuário.
11. Enviar e-mail de verificação de forma assíncrona via `user.created`.

## Erros

- E-mail já existente: `409 Conflict`.
- Username já existente: `409 Conflict`.
- DTO inválido: `400 Bad Request`.

## Email Verification

Usuários criados por credenciais podem logar imediatamente, mas recursos protegidos do produto ficam bloqueados por padrão até a confirmação do e-mail. O frontend deve ler `status` em `GET /users/me` e conduzir a UX de verificação quando receber `PENDING_EMAIL_VERIFICATION`.

## Decisão Importante

Sign-up por credenciais não vincula conta existente automaticamente. Veja [No automatic provider link](../decisions/no-automatic-provider-link.md).
