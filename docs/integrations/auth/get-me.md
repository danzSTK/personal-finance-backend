# 👤 GET /users/me

## 📋 Descrição

Retorna os dados do usuário autenticado a partir do access token JWT.

> Este endpoint pertence ao módulo `users`, mas é usado diretamente nos fluxos de autenticação para hidratar perfil e métodos vinculados.

## 🔐 Autenticação

✅ Requer Bearer Token:

```http
Authorization: Bearer <access_token>
```

## 📨 Request

```http
GET /users/me
```

Sem body e sem query params.

## ✅ Response de Sucesso

### Status
`200 OK`

### Body

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "lastName": "Silva",
  "firstName": "João",
  "userName": "joao_silva",
  "email": "joao.silva@email.com",
  "status": "ACTIVE",
  "createdAt": "2026-04-12T01:20:00.000Z",
  "updatedAt": "2026-04-12T01:20:00.000Z",
  "providers": [
    {
      "provider": "EMAIL",
      "linkedAt": "2026-04-12T01:20:00.000Z"
    },
    {
      "provider": "GOOGLE",
      "linkedAt": "2026-04-12T02:10:00.000Z"
    }
  ]
}
```

### Campos

| Campo | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | string (UUID) | Não | ID do usuário |
| `lastName` | string | Sim | Sobrenome |
| `firstName` | string | Sim | Primeiro nome |
| `userName` | string | Sim | Username |
| `email` | string | Não | Email principal |
| `status` | string | Não | Status da conta (`ACTIVE \| BLOCKED \| PENDING_PROFILE`) |
| `createdAt` | string (ISO 8601) | Não | Criação da conta |
| `updatedAt` | string (ISO 8601) | Não | Última atualização |
| `providers` | array | Não | Métodos de login vinculados |
| `providers[].provider` | `EMAIL \| GOOGLE \| APPLE` | Não | Tipo do provider |
| `providers[].linkedAt` | string (ISO 8601) | Não | Data do vínculo |

## ❌ Possíveis Erros

### 401 Unauthorized
Token ausente, inválido ou expirado.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

## 💡 Exemplo rápido (cURL)

```bash
curl -X GET http://localhost:3000/users/me \
  -H "Authorization: Bearer <access_token>"
```

## 🔗 Endpoints Relacionados

- [`POST /auth/sign-in`](./sign-in.md)
- [`POST /auth/sign-up`](./sign-up.md)
- [`POST /auth/refresh`](./refresh-tokens.md)
- [`POST /auth/logout`](./logout.md)
