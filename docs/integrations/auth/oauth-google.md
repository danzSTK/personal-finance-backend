# 🔐 OAuth Google

## GET /auth/google

Inicia login OAuth com Google.

- Público
- Status: `302` para consent screen do Google

## GET /auth/google/callback

Callback OAuth após consentimento.

- Público
- Status: `302` para frontend em `/auth/callback` (sem token em query)
- Backend define cookies HttpOnly (`accessToken`, `refreshToken`)

```text
Location: <frontend_url>/auth/callback
Set-Cookie: accessToken=...; HttpOnly; Path=/; ...
Set-Cookie: refreshToken=...; HttpOnly; Path=/auth; ...
```

## Frontend

Na rota `/auth/callback`, finalize carregando sessão via `/users/me` com `credentials: include`.  
Não capture token da URL e não armazene token em storage.
