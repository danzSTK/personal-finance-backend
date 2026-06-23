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
  "firstName": "João",
  "lastName": "Silva",
  "userName": "joao_silva",
  "email": "joao.silva@email.com",
  "avatarUrl": "https://assets.example.com/users/550e8400-e29b-41d4-a716-446655440000/avatars/fe52a36f-5fc7-43ce-8827-52a6aa17d478.webp",
  "status": "ACTIVE",
  "createdAt": "2026-06-20T12:00:00.000Z",
  "updatedAt": "2026-06-20T12:00:00.000Z",
  "providers": []
}
```

## Avatar

`avatarUrl` é `string | null`.

- Quando existe avatar atual e o asset está `READY`, o backend retorna uma URL pública pronta para renderização.
- Quando o usuário não tem avatar, ou quando a referência ainda não aponta para um asset pronto, o valor é `null`.
- O frontend não deve montar URL a partir de `assetId`, bucket ou storage key.

## cURL

```bash
curl -X GET http://localhost:3000/users/me -b cookies.txt
```
