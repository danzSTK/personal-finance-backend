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

| Campo        | Tipo             | Uso                                   |
| ------------ | ---------------- | ------------------------------------- |
| `statusCode` | `number`         | Status HTTP da resposta               |
| `code`       | `string`         | Código estável para regra de frontend |
| `message`    | `string`         | Mensagem humana de fallback           |
| `path`       | `string`         | Path da requisição                    |
| `timestamp`  | `string`         | Data ISO do erro                      |
| `details`    | `object \| null` | Contexto estruturado quando existir   |

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

| Code                    | Status | Quando                                                    |
| ----------------------- | -----: | --------------------------------------------------------- |
| `VALIDATION_ERROR`      |  `400` | Body/query/params falham na validação de DTO              |
| `UNAUTHORIZED`          |  `401` | Guard/autenticação rejeitou uma request sem sessão válida |
| `TOO_MANY_REQUESTS`     |  `429` | Throttling rejeitou requests acima do limite da rota      |
| `INTERNAL_SERVER_ERROR` |  `500` | Erro inesperado; mensagem interna não é exposta           |

## Auth And Sessions

| Code                                   | Status | Quando                                                                  |
| -------------------------------------- | -----: | ----------------------------------------------------------------------- |
| `AUTH_PROVIDER_ALREADY_LINKED`         |  `409` | Usuário já possui provider de auth daquele tipo                         |
| `AUTH_PROVIDER_LINKED_TO_ANOTHER_USER` |  `409` | Provider externo já pertence a outro usuário                            |
| `INVALID_ACCESS_TOKEN`                 |  `401` | Access token ausente, inválido ou inconsistente                         |
| `INVALID_REFRESH_TOKEN`                |  `401` | Refresh token ausente, inválido, expirado ou inconsistente              |
| `POTENTIAL_SESSION_HIJACKING`          |  `401` | Refresh token aponta para sessão inexistente e o backend revoga sessões |
| `SESSION_NOT_FOUND`                    |  `404` | Sessão solicitada não existe para o usuário                             |
| `EMAIL_VERIFICATION_COOLDOWN_ACTIVE`   |  `429` | Reenvio de verificação solicitado antes de 60 minutos                   |
| `EMAIL_VERIFICATION_DAILY_LIMIT_EXCEEDED` | `429` | Limite de 5 e-mails de verificação em 24 horas foi excedido             |
| `EMAIL_VERIFICATION_REQUIRED`          |  `403` | Usuário autenticado ainda precisa confirmar e-mail                      |
| `EMAIL_VERIFICATION_TOKEN_EXPIRED`     |  `410` | Token de confirmação de e-mail expirou                                  |
| `EMAIL_VERIFICATION_TOKEN_INVALID`     |  `400` | Token de confirmação de e-mail inválido                                 |
| `EMAIL_VERIFICATION_USER_BLOCKED`      |  `409` | Usuário bloqueado tentou confirmar e-mail                               |

## Users

| Code                        | Status | Quando                                                               |
| --------------------------- | -----: | -------------------------------------------------------------------- |
| `AVATAR_FILE_TOO_LARGE`     |  `413` | Imagem excede o limite de 5 MB                                       |
| `AVATAR_UPLOAD_FAILED`      |  `503` | Object Storage não concluiu o upload                                 |
| `INVALID_AVATAR_IMAGE`      |  `422` | Bytes possuem formato aceito, mas a imagem não pode ser decodificada |
| `INVALID_USERNAME_FORMAT`   |  `400` | Username viola regra do value object                                 |
| `UNSUPPORTED_AVATAR_FILE`   |  `415` | Assinatura dos bytes não corresponde a um formato aceito             |
| `USER_EMAIL_ALREADY_EXISTS` |  `409` | Email já está registrado                                             |
| `USERNAME_ALREADY_EXISTS`   |  `409` | Username já está registrado                                          |
| `USER_NOT_FOUND`            |  `404` | Usuário esperado não existe                                          |
| `USER_UPDATE_INPUT_VOID`    |  `400` | PATCH de perfil não informou nenhum campo editável                   |
| `INVALID_USER`              |  `400` | Nome ou outro dado simples do usuário viola uma regra de domínio     |

## Accounts

| Code                                 | Status | Quando                                                  |
| ------------------------------------ | -----: | ------------------------------------------------------- |
| `ACCOUNT_ALREADY_DEFAULT`            |  `409` | Account já é default                                    |
| `ACCOUNT_ARCHIVED`                   |  `409` | Operação comum não é permitida em account arquivada     |
| `ACCOUNT_ARCHIVED_MUTATION`          |  `409` | Domínio bloqueou alteração em account arquivada         |
| `ACCOUNT_CANNOT_BE_ARCHIVED`         |  `409` | Account não pode ser arquivada, por exemplo default     |
| `ACCOUNT_CANNOT_BE_DEFAULT`          |  `409` | Account não pode virar default, por exemplo arquivada   |
| `ACCOUNT_HAS_SCHEDULED_TRANSACTIONS` |  `409` | Account possui ações/transações futuras agendadas       |
| `ACCOUNT_MUST_REMAIN_ACTIVE`         |  `409` | Arquivamento deixaria o usuário sem account ativa       |
| `ACCOUNT_NOT_ARCHIVED`               |  `409` | Tentativa de desarquivar account que não está arquivada |
| `ACCOUNT_NOT_FOUND`                  |  `404` | Account não existe ou não pertence ao usuário           |
| `ACCOUNT_UPDATE_EMPTY`               |  `409` | PATCH não trouxe nenhum campo editável                  |
| `INVALID_ACCOUNT`                    |  `400` | Campo estrutural/visual da account é inválido           |
| `INVALID_ACCOUNT_NAME`               |  `400` | Nome da account é inválido                              |

## Categories

| Code                                   | Status | Quando                                                         |
| -------------------------------------- | -----: | -------------------------------------------------------------- |
| `CATEGORY_HAS_TRANSACTIONS`            |  `409` | Categoria tem transações e precisa de merge antes do delete    |
| `CATEGORY_INVALID_LIST_QUERY`          |  `400` | Filtros/paginação da listagem são inválidos                    |
| `CATEGORY_INVALID_MERGE`               |  `409` | Merge/delete com categoria alvo inválida                       |
| `CATEGORY_NAME_ALREADY_EXISTS`         |  `409` | Já existe categoria ativa com mesmo nome normalizado e tipo    |
| `CATEGORY_NOT_FOUND`                   |  `404` | Categoria não existe, não pertence ao usuário ou não é visível |
| `CATEGORY_NOT_MANAGEABLE`              |  `409` | Categoria de sistema/técnica/arquivada não aceita essa ação    |
| `CATEGORY_UPDATE_EMPTY`                |  `409` | PATCH não trouxe nenhum campo editável                         |
| `INVALID_CATEGORY`                     |  `400` | Campo de categoria viola regra de domínio                      |
| `TECHNICAL_CATEGORY_CANNOT_BE_CREATED` |  `400` | Frontend tentou criar categoria técnica manualmente            |

## Transactions

| Code                                   | Status | Quando                                                           |
| -------------------------------------- | -----: | ---------------------------------------------------------------- |
| `INVALID_TRANSACTION`                  |  `400` | Campos violam invariantes do domínio de transactions             |
| `TRANSACTION_ACCOUNT_UNAVAILABLE`      |  `409` | Account não existe, está arquivada ou não pode ser usada         |
| `TRANSACTION_ALREADY_EFFECTIVE`        |  `409` | Tentativa de confirmar transaction já efetivada                  |
| `TRANSACTION_CANNOT_DELETE_TRANSFER`   |  `409` | Frontend tentou deletar `TRANSFER`, que deve ser revertida       |
| `TRANSACTION_CATEGORY_INCOMPATIBLE`    |  `400` | Category não é compatível com o type da transaction              |
| `TRANSACTION_CATEGORY_UNAVAILABLE`     |  `409` | Category não existe, está arquivada ou não pode ser usada        |
| `TRANSACTION_INVALID_STATE_TRANSITION` |  `409` | Transição de estado inválida, como confirmar estado incompatível |
| `TRANSACTION_NOT_FOUND`                |  `404` | Transaction não existe, foi deletada ou não pertence ao usuário  |
| `TRANSACTION_UPDATE_EMPTY`             |  `409` | PATCH não trouxe nenhum campo editável                           |

## Regras Para O Frontend

- Use `code` para decidir UI, fallback e mensagens específicas.
- Use `details.fields` para destacar campos inválidos em formulários.
- Não dependa de texto exato em `message`.
- Para `401`, tente refresh/session flow quando aplicável.
- Para `409`, trate como conflito de regra de negócio, não como falha técnica.
