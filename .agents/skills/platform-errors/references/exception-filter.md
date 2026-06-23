# Exception Filter

Use the global exception filter as the only HTTP translator for escaped errors.

## Responsibilities

- Convert `DomainError` and `ApplicationError` to the platform HTTP error contract.
- Convert NestJS `HttpException` and validation errors to the same contract.
- Convert unknown errors to a safe `INTERNAL_SERVER_ERROR`.
- Log unknown/internal errors without leaking stack traces to clients.

## Mapping Guidance

Prefer a central mapping from error `code` to HTTP status instead of a long list of `instanceof` checks.

```ts
const ERROR_STATUS_BY_CODE = {
  INVALID_USERNAME_FORMAT: HttpStatus.BAD_REQUEST,
  USERNAME_ALREADY_EXISTS: HttpStatus.CONFLICT,
} as const;
```

The error class owns `code` and `message`; the filter owns HTTP status, path, timestamp, and serialization.

## Unknown Errors

Unknown errors must return:

```json
{
  "statusCode": 500,
  "code": "INTERNAL_SERVER_ERROR",
  "message": "Internal server error.",
  "path": "/request/path",
  "timestamp": "2026-06-08T12:00:00.000Z",
  "details": null
}
```

Never return raw SQL, stack traces, secrets, provider payloads, or internal exception names.
