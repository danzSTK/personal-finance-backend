# Domain Errors

Use `DomainError` for business invariants owned by the domain model.

## Rules

- Domain errors must not import NestJS, HTTP types, repositories, ORM entities, or infrastructure.
- Throw domain errors from entities, value objects, domain factories, and domain services.
- Name errors by the violated rule, not by HTTP status.
- Keep `code` stable; frontend and docs may depend on it after it is exposed.

## Shape

```ts
export abstract class DomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
```

Example:

```ts
export class InvalidUsernameFormatError extends DomainError {
  readonly code = 'INVALID_USERNAME_FORMAT';

  constructor(message = 'Invalid username format.') {
    super(message);
  }
}
```

## Use When

- A value object rejects invalid format.
- An entity rejects an invalid state transition.
- A factory rejects impossible domain construction.

Do not use `DomainError` for database uniqueness, missing rows, ownership checks, or external service failures. Those belong to application errors.
