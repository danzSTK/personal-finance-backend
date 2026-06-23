---
area: auth
type: concept
status: current
related:
  - ./cookie-based-auth.md
  - ../reference/cookies.md
---

# CSRF e Origin Check

Como a autenticação usa cookies, métodos mutáveis precisam de proteção contra origens indevidas.

O `OriginGuard` valida `Origin` ou `Referer` para métodos não seguros.

Regras:

- `GET`, `HEAD` e `OPTIONS` são métodos seguros.
- Requisições CLI sem `Origin` e sem `Referer` são aceitas.
- Browsers precisam usar origem permitida.
- `CSRF_ALLOWED_ORIGINS` deve conter as origens do frontend.
- Se usar Swagger em `/docs`, inclua também a origem da API (`APP_URL`).
