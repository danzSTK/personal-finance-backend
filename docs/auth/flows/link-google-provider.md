---
area: auth
type: flow
status: current
endpoint: GET /auth/providers/link/google
related:
  - ../concepts/auth-provider.md
  - ../decisions/google-link-state-in-redis.md
  - ../../integrations/auth/link-providers.md
---

# Link GOOGLE Provider

Vincula uma conta Google ao usuário autenticado.

## Início

1. Usuário precisa estar autenticado por JWT.
2. `GoogleLinkInitAuthGuard` cria `state` com UUID.
3. Guarda `state -> userId` no Redis com TTL de 10 minutos.
4. Redireciona para OAuth Google com esse `state`.

## Callback

1. Google retorna em `/auth/providers/link/google/callback`.
2. `GoogleLinkStrategy` valida `state`.
3. Executa `LinkGoogleProviderUseCase`.
4. Controller redireciona para o frontend.

## Redirects

- Sucesso: `${FRONTEND_URL}/auth/link?success=google`.
- Erro: `${FRONTEND_URL}/auth/link?error=<errorCode>`.
