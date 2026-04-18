# 👤 GET /users/me

Retorna o perfil do usuário autenticado.

## Autenticação

Cookie HttpOnly `accessToken` (enviado automaticamente pelo navegador/cliente HTTP).

## Request

```http
GET /users/me
```

## Success (`200`)

Body: `UserProfileResponseDto`.

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "joao.silva@email.com",
  "status": "ACTIVE",
  "providers": []
}
```

## cURL

```bash
curl -X GET http://localhost:3000/users/me -b cookies.txt
```
