---
area: auth
type: decision
status: current
related:
  - ../concepts/cookie-based-auth.md
  - ../reference/cookies.md
---

# Usar Cookies HttpOnly

## Decisão

Usar cookies HttpOnly para transportar `accessToken` e `refreshToken`.

## Motivos

- Reduz exposição dos tokens a JavaScript no browser.
- Evita `localStorage` e `sessionStorage`.
- Permite um fluxo consistente para login, refresh e logout.

## Consequências

- Clientes precisam usar `credentials: 'include'` ou `withCredentials: true`.
- Métodos mutáveis precisam de proteção de origem.
- Swagger/local tooling precisa considerar cookies.
