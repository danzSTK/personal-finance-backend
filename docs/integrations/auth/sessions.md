# 📱 Sessões

## GET /auth/sessions

Lista sessões ativas do usuário autenticado.

- Auth: cookie `accessToken` (HttpOnly)
- Status: `200`
- Body: array de sessões (`jti`, `browser`, `os`, `device`, `ip`, `location`, `loginAt`)

```bash
curl -X GET http://localhost:3000/auth/sessions -b cookies.txt
```

## DELETE /auth/sessions/:jti

Revoga uma sessão específica.

- Auth: cookie `accessToken` (HttpOnly)
- Status: `204`
- Body: vazio

```bash
curl -X DELETE http://localhost:3000/auth/sessions/<jti> -b cookies.txt
```
