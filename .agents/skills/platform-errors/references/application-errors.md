# Application Errors

Use `ApplicationError` for failures discovered while orchestrating a use case.

## Rules

- Application errors live outside the domain model.
- Use them when a repository/service result prevents the use case from completing.
- Do not expose database error messages directly; convert them to stable application errors.
- Prefer specific classes over generic messages.

## Shape

```ts
export abstract class ApplicationError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
```

Example:

```ts
export class UsernameAlreadyExistsError extends ApplicationError {
  readonly code = 'USERNAME_ALREADY_EXISTS';

  constructor(username: string) {
    super(`Username "${username}" already exists.`);
  }
}
```

## Use When

- A unique value already exists.
- A requested resource was not found.
- A user does not own the requested resource.
- A state conflict depends on persisted data.
- An external dependency prevents the use case from completing.

Use cases may catch a `DomainError` only when the use case intentionally converts it into a functional result, such as username availability returning `INVALID_FORMAT`.
