---
area: users
type: integration
status: current
endpoint: PATCH /users/me
---

# Update User Profile

Atualiza os campos simples do perfil do usuário autenticado.

```http
PATCH /users/me
```

## Body

Envie pelo menos um campo:

```json
{
  "firstName": "Daniel",
  "lastName": "Silva"
}
```

| Campo       | Tipo             | Obrigatório | Regra                                   |
| ----------- | ---------------- | ----------: | --------------------------------------- |
| `firstName` | `string \| null` |         não | Entre 2 e 255 caracteres; `null` remove |
| `lastName`  | `string \| null` |         não | Entre 2 e 255 caracteres; `null` remove |

Campos omitidos permanecem inalterados. O backend remove espaços externos antes de persistir.

## Resposta `200`

Retorna o perfil completo atualizado:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "daniel@example.com",
  "userName": "daniel",
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

| Status | Code                     | Quando                                  |
| -----: | ------------------------ | --------------------------------------- |
|  `400` | `VALIDATION_ERROR`       | Campo enviado falha na validação do DTO |
|  `400` | `USER_UPDATE_INPUT_VOID` | Nenhum campo editável foi informado     |
|  `400` | `INVALID_USER`           | Nome viola regra do domínio             |
|  `401` | `UNAUTHORIZED`           | Sessão ausente ou inválida              |

O frontend deve usar `code`, não `message`, para decidir o comportamento.

## Regras Para O Frontend

- Não envie `userId`.
- Não envie `username` nem `email` nesta rota.
- Envie somente os campos alterados.
- Use `null` quando o usuário quiser remover `firstName` ou `lastName`.
- Atualize o cache local do perfil com o response `200`.
