---
area: auth
type: index
status: current
---

# Auth

Este diretório documenta as regras de negócio, decisões arquiteturais e fluxos internos do módulo de autenticação.

Para documentação de consumo HTTP, use [Integração Auth](../integrations/auth/README.md).

## Mapa

## Canvas

- [Auth architecture canvas](./auth.canvas)
- [Google provider link canvas](./google-provider-link.canvas)

### Conceitos

- [Cookie-based auth](./concepts/cookie-based-auth.md)
- [Access token](./concepts/access-token.md)
- [Refresh token](./concepts/refresh-token.md)
- [Sessão stateful](./concepts/session-state.md)
- [Auth provider](./concepts/auth-provider.md)
- [CSRF e origin check](./concepts/csrf-origin-check.md)

### Fluxos

- [Sign-up](./flows/sign-up.md)
- [Sign-in](./flows/sign-in.md)
- [Google login](./flows/google-login.md)
- [Refresh token rotation](./flows/refresh-token-rotation.md)
- [Logout](./flows/logout.md)
- [Sessões ativas](./flows/sessions.md)
- [Link EMAIL provider](./flows/link-email-provider.md)
- [Link GOOGLE provider](./flows/link-google-provider.md)

### Decisões

- [Usar cookies HttpOnly](./decisions/use-http-only-cookies.md)
- [Refresh token stateful no Redis](./decisions/stateful-refresh-token-in-redis.md)
- [Não vincular providers automaticamente](./decisions/no-automatic-provider-link.md)
- [State Redis no link Google](./decisions/google-link-state-in-redis.md)

### Referência

- [Endpoints](./reference/endpoints.md)
- [Redis keys](./reference/redis-keys.md)
- [Cookies](./reference/cookies.md)
- [Throttling](./reference/throttling.md)
- [Erros e redirects](./reference/error-codes.md)

## Notas Legadas

- [auth.v1](./legacy/auth.v1.md)
- [auth.v2](./auth.v2.md)
