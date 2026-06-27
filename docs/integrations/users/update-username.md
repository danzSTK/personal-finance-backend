---
area: users
type: integration
status: current
endpoint: PUT /users/me/username
---

# Change Username

Atualiza o username do usuário autenticado.

```http
PUT /users/me/username
Content-Type: application/json
```

## Autenticação

Use o cookie HttpOnly `accessToken` e envie a request com credenciais. Não envie `userId`.

## Body

```json
{
  "username": "novo_username"
}
```

| Campo      | Tipo     | Obrigatório | Regra                                         |
| ---------- | -------- | ----------: | --------------------------------------------- |
| `username` | `string` |         sim | 3 a 50 caracteres; letras, números, `_` e `-` |

O backend remove espaços externos e converte para lowercase antes de validar e persistir.

## Resposta `200`

Retorna o perfil completo atualizado:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "daniel@example.com",
  "userName": "novo_username",
  "firstName": "Daniel",
  "lastName": "Silva",
  "avatarUrl": "https://assets.example.com/users/550e8400-e29b-41d4-a716-446655440000/avatars/avatar-id.webp",
  "status": "ACTIVE",
  "providers": [],
  "createdAt": "2026-06-01T10:00:00.000Z",
  "updatedAt": "2026-06-18T10:00:00.000Z"
}
```

`avatarUrl` pode ser `null` quando o usuário não tiver avatar pronto.

## Erros

| Status | Code                      | Quando                                 |
| -----: | ------------------------- | -------------------------------------- |
|  `400` | `VALIDATION_ERROR`        | Body enviado falha na validação do DTO |
|  `400` | `INVALID_USERNAME_FORMAT` | Username viola regra do domínio        |
|  `401` | `UNAUTHORIZED`            | Sessão ausente ou inválida             |
|  `404` | `USER_NOT_FOUND`          | Usuário autenticado não existe mais    |
|  `409` | `USERNAME_ALREADY_EXISTS` | Username já pertence a outro usuário   |
|  `429` | `TOO_MANY_REQUESTS`       | Limite de tentativas excedido          |

O frontend deve usar `code`, não `message`, para decidir o comportamento.

## Throttling

A rota aceita 3 tentativas por minuto. Após exceder o limite, novas tentativas ficam bloqueadas por 10 minutos.

## Regras Para O Frontend

- Não envie `userId`.
- Chame `GET /users/usernames/:username/availability` para feedback preventivo, mas trate `409` mesmo assim.
- Atualize o cache local do perfil com o response `200`.
- Para `USERNAME_ALREADY_EXISTS`, peça outro username.
- Para `TOO_MANY_REQUESTS`, aguarde antes de permitir nova tentativa.
