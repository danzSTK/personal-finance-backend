# Error Contract

All frontend-facing errors should follow one predictable shape.

## Base Shape

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

## Field Rules

- `statusCode`: HTTP status as number.
- `code`: stable machine-readable contract; frontend logic should use this.
- `message`: human-readable fallback; do not make frontend logic depend on it.
- `path`: request path.
- `timestamp`: ISO string.
- `details`: optional structured context.

## Validation Shape

DTO validation errors should use `VALIDATION_ERROR`:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed.",
  "path": "/auth/sign-up",
  "timestamp": "2026-06-08T12:00:00.000Z",
  "details": {
    "fields": [
      {
        "field": "email",
        "messages": ["This email address is not a valid address."]
      }
    ]
  }
}
```

Document new frontend-visible codes in `docs/integrations/errors.md` when the platform starts exposing them.
