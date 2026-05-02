---
area: auth
type: flow
status: current
endpoint: GET /auth/google
related:
  - ../concepts/auth-provider.md
  - ../concepts/cookie-based-auth.md
  - ../../integrations/auth/oauth-google.md
---

# Google Login

Login social com Google OAuth.

## Fluxo

1. `GET /auth/google` redireciona para consentimento Google.
2. Google retorna em `GET /auth/google/callback`.
3. `GoogleStrategy` exige e-mail no profile.
4. `OAuthCallbackUseCase` procura provider `GOOGLE` pelo `googleId`.
5. Se existir provider, retorna usuário.
6. Se não existir, abre transação:
   - busca usuário por e-mail;
   - se existir, adiciona provider `GOOGLE`;
   - se não existir, cria usuário com status `PENDING_PROFILE`.
7. API gera tokens próprios.
8. Seta cookies HttpOnly.
9. Redireciona para `${FRONTEND_URL}/auth/callback`.

## Regra Atual

O callback não deve expor token na URL. A sessão chega ao frontend por cookies HttpOnly.
