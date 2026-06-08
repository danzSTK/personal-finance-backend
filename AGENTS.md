# Personal Finance Backend - Codex Instructions

## Project Overview

Multi-tenant personal finance API built with NestJS, TypeScript, PostgreSQL, and Redis. The backend follows Clean Architecture with DDD principles.

Stack:

- Node.js 22 + NestJS 11
- PostgreSQL with TypeORM 0.3
- Redis for cache and session management
- Docker Compose for local development

Run project commands from `api/` unless the command explicitly says otherwise.

## Common Commands

```bash
npm run start:dev
npm run build
npm run test
npm run test:e2e
npm run test:cov
npm run lint
npm run format
npm run migration:generate --name=AddColumnX
npm run migration:create --name=CustomMigration
npm run migration:run
npm run migration:revert
npm run migration:show
```

Docker commands run from the backend root:

```bash
docker compose up -d
docker compose logs -f api
docker compose down
```

## Interaction Style

Respond in Portuguese by default.

For feature requests, start with a concise architecture-first response:

1. **O PLANO:** layers, components, and data flow.
2. **O PORQUÊ:** trade-offs and why the approach fits.
3. **O COMO:** conceptual implementation and NestJS patterns involved.
4. **VALIDAÇÃO:** ask whether to continue to code or adjust the strategy.

Do not generate full implementation code on the first response unless the user explicitly says `Pode codar` or `Mostre o código`. When the user asks for a concrete code change in this Codex environment, follow the newest user request and implement once intent is clear.

## Architecture Rules

When implementing or changing error handling, use the repo skill `platform-errors`. Domain and application errors should be framework-independent and translated to the frontend HTTP contract by a global exception filter.

Each domain module under `api/src/modules/<domain>/` follows this structure:

```text
modules/<domain>/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── repositories/
│   └── factories/
├── application/
│   └── use-cases/<action>/
│       ├── <action>.use-case.ts
│       └── <action>.dto.ts
├── infrastructure/
│   ├── persistence/
│   └── mappers/
└── presentation/
    ├── http/
    └── dto/
```

Use `@/` imports for project code. Do not use `src/*` imports.

## Domain Layer

- Domain entities must not import TypeORM decorators, ORM entities, or infrastructure concerns.
- Domain entities must not import `@nestjs/common`; temporary exception: existing value objects may still throw `BadRequestException` until migrated to domain exceptions.
- Entities expose state through getters, not public mutable fields.
- Prefer `private readonly props: <Name>Props` plus `public readonly id: string`.
- Use `static create()` for validation and creation.
- Use `static reconstitute()` for trusted DB/cache hydration.
- Collections such as `authProviders` return `ReadonlyArray<T>`.
- Value objects are immutable and expose `create`, `reconstitute`, `value`, and `equals`.
- Validation constants come from `@/common/models/constants`; avoid hardcoded validation limits.
- Repository interfaces live in the domain and must not expose TypeORM APIs.

## Application Layer

- One directory per use case: `application/use-cases/<action>/`.
- Each use case directory contains `<action>.use-case.ts` and `<action>.dto.ts`.
- Use cases are `@Injectable()` classes with `execute(dto, options?)`.
- Use cases orchestrate domain and infrastructure; business rules stay in domain entities/value objects.
- Use cases inject repository interfaces, never concrete TypeORM or cached repositories.
- Use case DTOs are plain TypeScript interfaces, not `class-validator` classes.
- NestJS HTTP exceptions are acceptable in use cases when needed.

## Infrastructure Layer

- ORM entities live in `infrastructure/persistence/`.
- ORM entity files use `<name>-orm-entity.ts` or `<name>-orm.entity.ts`.
- Sensitive fields such as `passwordHash` and `refreshTokenHash` must use `{ select: false }`.
- ORM entities are never imported outside infrastructure.
- Repositories implement domain interfaces.
- Cached repositories use the Decorator pattern around the base repository.
- Cache keys must use the project cache key factory in `@/common/utils/cache-key-factory`.
- Default read cache TTL is 5 minutes; invalidate immediately on writes/deletes.
- Mappers live in `infrastructure/mappers/`.
- `toDomain()` uses value object `reconstitute()`, not `create()`.
- `toPersistence()` extracts primitive values from domain objects.

## Presentation Layer

- Controllers live in `presentation/http/` and stay thin.
- Controllers deserialize request, call use cases, and serialize response.
- Controllers must not contain business logic or direct repository calls.
- Protected endpoints use `@UseGuards(JwtAuthGuard)` by default.
- Public endpoints are explicitly marked with `@Public()`.
- Access the authenticated user with `@CurrentUser()`, never from request body.
- Request DTOs live in `presentation/dto/` and use `class-validator` and `class-transformer`.
- Use `@Type()` for numeric, date, and nested object fields.
- Always return response DTOs; never expose domain entities or ORM entities directly.
- Sensitive fields and tokens must never appear in response DTOs.

## Security

- Filter all tenant/user data by `userId` from JWT payload, never request body.
- Store JWTs in HTTP-only cookies.
- Refresh tokens rotate on use.
- Use Redis blacklist/session tracking for logout and password-change invalidation.
- OAuth secrets and environment-specific values come through `ConfigService`.
- Rate-limit authentication endpoints.
- Never expose stack traces or raw database errors to clients.

## Financial Domain Rules

- Never use JavaScript `number` for currency calculations.
- Use `decimal.js`, `big.js`, or integer cents for money.
- Store money as integer cents when persisted.
- Transactions must include `userId`, `categoryId`, `accountId`, and `date`.
- Validate account balance before debits.
- Reconciled transactions are immutable; edits should return conflict semantics.

## Testing

- Domain tests are pure Node.js tests. Do not instantiate Nest `TestingModule` for entities or value objects.
- Use case tests use `@nestjs/testing` and mock repository interfaces, not concrete repositories.
- Verify repository `save()` receives a domain entity, not primitive data.
- Infrastructure tests may use SQLite in memory or Testcontainers for real TypeORM behavior.
- Do not test cached repositories against real Redis; mock `REDIS_CLIENT`.
- Controller E2E tests live under `api/test/` and use supertest against the initialized Nest app.
- Coverage targets: 90% for domain and application use cases, 70% for infrastructure.
- Use one root `describe` per spec file, nested `describe` blocks per method/scenario, and `jest.clearAllMocks()` in `beforeEach`.
- No tests should rely on `setTimeout` or execution order.

## Migrations

Always create a TypeORM migration for schema changes:

1. Modify the ORM entity.
2. Generate or create the migration.
3. Review generated SQL in `src/database/migrations/`.
4. Run the migration.

Never ship entity schema changes without a migration. Never modify applied migrations; create a new migration to revert or adjust.

## Code Style

- Use Conventional Commits in Portuguese.
- Avoid `any`.
- Handle promises deliberately; do not leave floating promises.
- Use Prettier and the repo ESLint config.
- Prefer existing project patterns and helpers over new abstractions.
