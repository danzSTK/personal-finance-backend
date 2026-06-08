---
area: platform
type: integration
status: current
---

# Error Contract

Todos os erros HTTP da API devem seguir um formato previsível para o frontend.

Para o padrão interno de implementação, leia [Platform Error Handling](../errors/README.md).

```json
{
  "statusCode": 409,
  "code": "ACCOUNT_ARCHIVED",
  "message": "Archived account cannot be updated.",
  "path": "/accounts/5f6b18c6-1fd9-4e8f-99a8-4a7b65ef56e2",
  "timestamp": "2026-06-08T12:00:00.000Z",
  "details": null
}
```

## Campos

| Campo | Tipo | Uso |
|---|---|---|
| `statusCode` | `number` | Status HTTP da resposta |
| `code` | `string` | Código estável para regra de frontend |
| `message` | `string` | Mensagem humana de fallback |
| `path` | `string` | Path da requisição |
| `timestamp` | `string` | Data ISO do erro |
| `details` | `object \| null` | Contexto estruturado quando existir |

O frontend deve tomar decisão pelo `code`, não pelo `message`.

## Validation Error

Erros de DTO usam `VALIDATION_ERROR`.

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed.",
  "path": "/accounts",
  "timestamp": "2026-06-08T12:00:00.000Z",
  "details": {
    "fields": [
      {
        "field": "name",
        "messages": ["name must be longer than or equal to 3 characters"]
      }
    ]
  }
}
```

## Códigos Globais

| Code | Status | Quando |
|---|---:|---|
| `VALIDATION_ERROR` | `400` | Body/query/params falham na validação de DTO |
| `INTERNAL_SERVER_ERROR` | `500` | Erro inesperado; mensagem interna não é exposta |

## Auth And Sessions

| Code | Status | Quando |
|---|---:|---|
| `AUTH_PROVIDER_ALREADY_LINKED` | `409` | Usuário já possui provider de auth daquele tipo |
| `AUTH_PROVIDER_LINKED_TO_ANOTHER_USER` | `409` | Provider externo já pertence a outro usuário |
| `INVALID_ACCESS_TOKEN` | `401` | Access token ausente, inválido ou inconsistente |
| `INVALID_REFRESH_TOKEN` | `401` | Refresh token ausente, inválido, expirado ou inconsistente |
| `POTENTIAL_SESSION_HIJACKING` | `401` | Refresh token aponta para sessão inexistente e o backend revoga sessões |
| `SESSION_NOT_FOUND` | `404` | Sessão solicitada não existe para o usuário |

## Users

| Code | Status | Quando |
|---|---:|---|
| `INVALID_USERNAME_FORMAT` | `400` | Username viola regra do value object |
| `USER_EMAIL_ALREADY_EXISTS` | `409` | Email já está registrado |
| `USERNAME_ALREADY_EXISTS` | `409` | Username já está registrado |
| `USER_NOT_FOUND` | `404` | Usuário esperado não existe |

## Accounts

| Code | Status | Quando |
|---|---:|---|
| `ACCOUNT_ALREADY_DEFAULT` | `409` | Account já é default |
| `ACCOUNT_ARCHIVED` | `409` | Operação comum não é permitida em account arquivada |
| `ACCOUNT_ARCHIVED_MUTATION` | `409` | Domínio bloqueou alteração em account arquivada |
| `ACCOUNT_CANNOT_BE_ARCHIVED` | `409` | Account não pode ser arquivada, por exemplo default |
| `ACCOUNT_CANNOT_BE_DEFAULT` | `409` | Account não pode virar default, por exemplo arquivada |
| `ACCOUNT_HAS_SCHEDULED_TRANSACTIONS` | `409` | Account possui ações/transações futuras agendadas |
| `ACCOUNT_MUST_REMAIN_ACTIVE` | `409` | Arquivamento deixaria o usuário sem account ativa |
| `ACCOUNT_NOT_ARCHIVED` | `409` | Tentativa de desarquivar account que não está arquivada |
| `ACCOUNT_NOT_FOUND` | `404` | Account não existe ou não pertence ao usuário |
| `ACCOUNT_UPDATE_EMPTY` | `409` | PATCH não trouxe nenhum campo editável |
| `INVALID_ACCOUNT` | `400` | Campo estrutural/visual da account é inválido |
| `INVALID_ACCOUNT_NAME` | `400` | Nome da account é inválido |

## Categories

| Code | Status | Quando |
|---|---:|---|
| `CATEGORY_HAS_TRANSACTIONS` | `409` | Categoria tem transações e precisa de merge antes do delete |
| `CATEGORY_INVALID_LIST_QUERY` | `400` | Filtros/paginação da listagem são inválidos |
| `CATEGORY_INVALID_MERGE` | `409` | Merge/delete com categoria alvo inválida |
| `CATEGORY_NAME_ALREADY_EXISTS` | `409` | Já existe categoria ativa com mesmo nome normalizado e tipo |
| `CATEGORY_NOT_FOUND` | `404` | Categoria não existe, não pertence ao usuário ou não é visível |
| `CATEGORY_NOT_MANAGEABLE` | `409` | Categoria de sistema/técnica/arquivada não aceita essa ação |
| `CATEGORY_UPDATE_EMPTY` | `409` | PATCH não trouxe nenhum campo editável |
| `INVALID_CATEGORY` | `400` | Campo de categoria viola regra de domínio |
| `TECHNICAL_CATEGORY_CANNOT_BE_CREATED` | `400` | Frontend tentou criar categoria técnica manualmente |

## Regras Para O Frontend

- Use `code` para decidir UI, fallback e mensagens específicas.
- Use `details.fields` para destacar campos inválidos em formulários.
- Não dependa de texto exato em `message`.
- Para `401`, tente refresh/session flow quando aplicável.
- Para `409`, trate como conflito de regra de negócio, não como falha técnica.
