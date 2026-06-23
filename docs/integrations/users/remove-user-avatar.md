---
area: users
type: integration
status: current
endpoint: DELETE /users/me/avatar
---

# Remove User Avatar

Remove o avatar atual do usuário autenticado.

```http
DELETE /users/me/avatar
```

## Autenticação

Use o cookie HttpOnly `accessToken` e envie a request com credenciais. A rota não recebe body.

## Resposta `204`

Não há body de resposta. A operação é idempotente: se o usuário já estiver sem avatar, o backend também retorna `204`.

## Erros

| Status | Code             | Quando                              |
| -----: | ---------------- | ----------------------------------- |
|  `401` | `UNAUTHORIZED`   | Sessão ausente ou inválida          |
|  `404` | `USER_NOT_FOUND` | Usuário autenticado não existe mais |

## Remoção Assíncrona

O `204` confirma que o usuário não referencia mais o avatar. A remoção física no R2 ocorre depois pelo evento `user.avatar.removed`.

Falhas no Object Storage mantêm o asset em `DELETE_PENDING` e são repetidas pela outbox. O frontend não precisa aguardar nem repetir o DELETE por causa dessa limpeza.
