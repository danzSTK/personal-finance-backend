---
name: platform-errors
description: Use when implementing, reviewing, or refactoring error handling in this NestJS backend, including DomainError, ApplicationError, exception filters, validation errors, HTTP error contracts, frontend-facing error responses, and any feature/fix that introduces or changes thrown errors.
---

# Platform Errors

Follow this skill whenever code creates, throws, catches, maps, serializes, or documents errors.

## Core Rules

- Keep domain errors framework-free. Domain entities and value objects throw `DomainError` subclasses, never NestJS HTTP exceptions.
- Keep application errors in use cases. Use `ApplicationError` for orchestration failures such as uniqueness, ownership, not found, conflict, or invalid state discovered through repositories/services.
- Treat NestJS `HttpException` as presentation/legacy compatibility, not the preferred domain/application contract.
- Let controllers stay thin. Controllers call use cases and return DTOs; they should not translate business errors manually.
- Use a global exception filter to translate escaped errors into HTTP responses.
- Never expose stack traces, raw SQL errors, secrets, or internal exception messages to clients.

## Error Response Contract

All HTTP errors should be predictable for the frontend:

```json
{
  "statusCode": 400,
  "code": "INVALID_USERNAME_FORMAT",
  "message": "Invalid username format.",
  "path": "/users/usernames/foo/availability",
  "timestamp": "2026-06-08T12:00:00.000Z",
  "details": null
}
```

Use `code` as the stable frontend contract. `message` is human-facing and may evolve.

For validation errors, return a structured details payload:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed.",
  "details": {
    "fields": [
      { "field": "email", "messages": ["This email address is not a valid address."] }
    ]
  }
}
```

## Layer Decision

- **DomainError:** invariant violated inside domain model or value object.
- **ApplicationError:** use case cannot complete because of repository/service state.
- **DTO validation:** malformed transport input.
- **Unknown error:** log internally and return `INTERNAL_SERVER_ERROR`.

## Workflow

1. Identify which layer owns the failure.
2. Create or reuse a specific error class with a stable `code`.
3. Throw the domain/application error from the owning layer.
4. Map it in the global exception filter or central registry.
5. Update integration docs when a frontend-visible `code` is introduced.
6. Add focused tests for the use case/filter when behavior is non-trivial.

## References

- Read `references/domain-errors.md` when creating or migrating errors in entities/value objects.
- Read `references/application-errors.md` when a use case needs to fail because of repository/service state.
- Read `references/exception-filter.md` when implementing or changing the global HTTP mapping.
- Read `references/error-contract.md` when documenting or changing frontend-facing error responses.
