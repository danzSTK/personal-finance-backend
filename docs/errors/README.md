---
area: platform-errors
type: architecture
status: current
---

# Platform Error Handling

Esta nota descreve o padrão interno de erros da plataforma. Para o contrato consumido pelo frontend, leia [Error contract](../integrations/errors.md).

Mapa visual: [Request lifecycle errors](../Excalidraw/Request-lifecycle-errors.excalidraw.md).

## Objetivo

Toda request deve retornar erro em um formato previsível, sem vazar stack trace, SQL bruto, secrets ou detalhes internos.

O formato HTTP final é produzido pelo `AppExceptionFilter`:

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

O frontend deve usar `code` como contrato estável. `message` é fallback humano e pode mudar.

## Fluxo Da Request

```text
Request HTTP
  -> Controller
  -> Use case
  -> Domain entity/value object/factory
  -> DomainError ou ApplicationError
  -> AppExceptionFilter
  -> PlatformErrorResponse
```

Nem controller nem use case devem montar resposta HTTP manualmente. O erro escapa e o filtro global traduz.

## DomainError

Use `DomainError` quando a própria regra do domínio é violada.

Exemplos:

- value object rejeita formato inválido;
- entity bloqueia transição de estado;
- factory rejeita criação impossível para o domínio.

Base:

```ts
export abstract class DomainError extends Error {
  abstract readonly code: string;
}
```

Local:

```text
api/src/modules/<module>/domain/errors/
```

Exemplo:

```ts
export class AccountArchivedMutationError extends DomainError {
  readonly code = 'ACCOUNT_ARCHIVED_MUTATION';

  constructor(message = 'Archived account cannot be changed.') {
    super(message);
  }
}
```

Regra importante: domínio não importa `@nestjs/common`, ORM, repository ou HTTP.

## ApplicationError

Use `ApplicationError` quando o use case descobre, pela orquestração, que a operação não pode continuar.

Exemplos:

- recurso não encontrado;
- conflito de unicidade vindo do banco/repositório;
- usuário não é dono do dado;
- sessão/token inválido;
- estado persistido bloqueia a ação.

Base:

```ts
export abstract class ApplicationError extends Error {
  abstract readonly code: string;

  get details(): Record<string, unknown> | null {
    return null;
  }
}
```

Subclasses podem sobrescrever `details` para retornar metadados estruturados seguros ao cliente (como IDs conflitantes em erros `409`). Para erros que exigem tempo de espera explícito (`429`, `503`), estenda `RetryAfterApplicationError`, que expõe `details: { retryAfterSeconds }` e instrui o `AppExceptionFilter` a definir o header HTTP `Retry-After`.

Local:

```text
api/src/modules/<module>/application/errors/
```

Exemplo:

```ts
export class UserNotFoundError extends ApplicationError {
  readonly code = 'USER_NOT_FOUND';

  constructor(message = 'User not found.') {
    super(message);
  }
}
```

## DTO Validation

Erros de entrada HTTP continuam na borda e são criados pelo `ValidationPipe.exceptionFactory`.

Arquivo:

```text
api/src/common/validation/validation-exception.factory.ts
```

Esses erros usam sempre:

```text
code = VALIDATION_ERROR
statusCode = 400
```

`details.fields` deve ser usado pelo frontend para destacar campos inválidos.

## AppExceptionFilter

Arquivo:

```text
api/src/common/filters/app-exception.filter.ts
```

Responsabilidades:

- transformar `DomainError` em HTTP;
- transformar `ApplicationError` em HTTP;
- normalizar `HttpException` legado;
- transformar erro desconhecido em `INTERNAL_SERVER_ERROR`;
- logar erro interno sem expor detalhes ao cliente.

Sempre que um novo `code` for criado, ele deve ser registrado em:

```ts
const ERROR_STATUS_BY_CODE: Record<string, HttpStatus> = {
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
};
```

Se o code for exposto ao frontend, atualize também [Error contract](../integrations/errors.md).

## Onde Criar Um Novo Erro

| Situação | Classe | Pasta |
|---|---|---|
| Value object rejeitou formato | `DomainError` | `domain/errors` |
| Entity bloqueou ação | `DomainError` | `domain/errors` |
| Factory bloqueou criação por regra de domínio | `DomainError` | `domain/errors` |
| Repository encontrou duplicidade | `ApplicationError` | `application/errors` |
| Use case não achou recurso | `ApplicationError` | `application/errors` |
| Token/sessão inválida em fluxo application | `ApplicationError` | `application/errors` |
| DTO/body/query inválido | `VALIDATION_ERROR` | `common/validation` |

## Checklist

Ao criar ou migrar erro:

1. Defina se é domínio, aplicação ou DTO.
2. Crie uma classe específica com `code` estável.
3. Lance o erro na camada dona da regra.
4. Registre o `code` em `ERROR_STATUS_BY_CODE`.
5. Atualize `docs/integrations/errors.md` se o frontend puder receber esse erro.
6. Use `PlatformErrorResponseDto` em Swagger quando documentar respostas de erro.
7. Rode `npm run build`, `npm run lint` e testes relevantes.

## Swagger

O shape padrão de erro no Swagger é:

```text
api/src/common/dto/platform-error.response.dto.ts
```

Use esse DTO nas respostas `400`, `401`, `404`, `409` e `500` quando o endpoint puder retornar erro padronizado.

## Códigos de `fiscal-notes` e Vínculo com `transactions`

O catálogo completo de erros e contratos HTTP de NFC-e está em [HTTP and Error Contracts](../fiscal-notes/reference/http-and-error-contracts.md):

| Código | HTTP Status | Origem / Observação |
| --- | --- | --- |
| `FISCAL_NOTE_INVALID_INPUT` | `400` | `ApplicationError` — entrada vazia/malformada, modelo != `65` ou DV mod-11 inválido |
| `INVALID_FISCAL_NOTE` | `400` | `DomainError` — violação de invariante da entidade `FiscalNote`, item ou pagamento |
| `FISCAL_NOTE_NOT_FOUND` | `404` | `ApplicationError` — transação sem nota fiscal ativa vinculada |
| `FISCAL_NOTE_SEFAZ_NOT_FOUND` | `404` | `ApplicationError` — nota não encontrada ou QR inválido na SEFAZ |
| `FISCAL_NOTE_ALREADY_IMPORTED` | `409` | `ApplicationError` — `details: { existingTransactionId, existingFiscalNoteId }` |
| `TRANSACTION_ALREADY_HAS_FISCAL_NOTE` | `409` | `ApplicationError` — `details: { existingFiscalNoteId }` |
| `TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE` | `409` | `DomainError` (`transactions`) — vínculo ou troca de `type` não-`EXPENSE` com nota ativa |
| `FISCAL_NOTE_UNSUPPORTED_UF` | `422` | `ApplicationError` — UF sem provedor suportado na V1 |
| `FISCAL_NOTE_HOMOLOGATION_NOT_ALLOWED` | `422` | `ApplicationError` — ambiente de homologação rejeitado |
| `FISCAL_NOTE_CANCELLED_OR_DENIED` | `422` | `ApplicationError` — nota cancelada ou denegada na SEFAZ |
| `FISCAL_NOTE_RATE_LIMIT_EXCEEDED` | `429` | `RetryAfterApplicationError` — `details: { retryAfterSeconds }` + header `Retry-After` |
| `FISCAL_NOTE_PARSE_FAILED` | `502` | `ApplicationError` — erro estrutural/integridade no parsing da SEFAZ |
| `FISCAL_NOTE_RESPONSE_TOO_LARGE` | `502` | `ApplicationError` — resposta da SEFAZ acima de 1 MB |
| `SEFAZ_TEMPORARILY_UNAVAILABLE` | `503` | `RetryAfterApplicationError` — `details: { retryAfterSeconds }` + header `Retry-After` |
| `SEFAZ_TIMEOUT` | `504` | `ApplicationError` — timeout na consulta à SEFAZ |
