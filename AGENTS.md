# Personal Finance Backend - Codex Instructions

## Project Overview

Multi-tenant personal finance API built with NestJS, TypeScript, PostgreSQL, and Redis. The backend follows Clean Architecture with DDD principles.

Stack:

- Node.js 24 + NestJS 11
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

Use Spec-Driven Development as the default workflow for new features and relevant feature changes. Before coding a feature, use the repo skill `spec-driven-development` and create or update:

```text
docs/specs/<module>/<feature>/specs/
├── requirements.md
├── design.md
├── tasks.md
└── decisions.md
```

`requirements.md`, `design.md`, and `tasks.md` must exist and be reviewed or explicitly approved before implementation starts. During implementation, any business-rule change updates `requirements.md`; any technical design change updates `design.md`; any task scope/order change updates `tasks.md`; and any trade-off or decision is recorded in `decisions.md`.

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
- Response DTOs should declare an `object` string property that identifies the response shape for consumers. Use centralized values from `@/common/models/constants`, with keys separated by module/shape such as `transaction.list`, `transaction_summary.type`, and `account.list`. Dynamic responses must use one DTO per shape and each shape must expose its own `object`.
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

## Temporal Data Rules

- Separate `DateOnly` from `Instant`.
- `DateOnly` is a civil date string in `YYYY-MM-DD`, with no time and no timezone. Examples: `transactions.date`, `dateFrom`, `dateTo`, `projectedUntil`.
- Do not convert `DateOnly` to JavaScript `Date`; do not serialize it with `toISOString().slice(0, 10)`.
- Persist `DateOnly` values in PostgreSQL `date` columns by sending the `YYYY-MM-DD` string.
- `Instant` is an exact point in time. Examples: `createdAt`, `updatedAt`, `effectiveAt`, `deletedAt`, `occurredAt`.
- Persist `Instant` values in PostgreSQL `timestamptz` columns and expose them as ISO 8601 UTC.
- Frontend clients may convert `Instant` values to the user's local timezone for display, but must not timezone-shift `DateOnly` values.

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

Before planning, creating, generating, reviewing, or running a migration, use the repository skill `migration-rollout`. Its `expand -> migrate -> contract` workflow, `docs/database/migration-rollout.md`, and `docs/architecture/compatibility.md` are mandatory for migration work.

Before creating, generating, or running any migration, read `docs/database/schema.md` and the relevant existing migrations to understand current tables, indexes, triggers, functions, enums, and naming conventions. Reuse existing database objects when appropriate; do not create duplicate functions/triggers or introduce overlapping infrastructure objects.

1. Modify the ORM entity.
2. Generate or create the migration.
3. Review generated SQL in `src/database/migrations/`.
4. Update `docs/database/schema.md` whenever the migration creates, drops, renames, or changes any table, column, constraint, index, trigger, function, enum, or database-level invariant.
5. Run the migration.

Never ship entity schema changes without a migration. Never modify applied migrations; create a new migration to revert or adjust.

## Code Review Rules

Passing builds, tests, lint, and type checks is necessary but not sufficient for approval. Review the changed behavior against every applicable invariant in this file and the authoritative documentation below. Focus findings on correctness, reliability, compatibility, security, and consequential maintainability risks introduced by the pull request; leave formatting and other deterministic checks to CI.

For every finding:

- Identify the affected file and line, the violated invariant or authoritative document, and an observable failure scenario.
- Explain the consequence and provide a safe implementation path.
- Assign priority from impact and reachability, not preference. Do not report speculative issues without a concrete path to failure or preference-only nits when the implementation follows a documented safe path.
- Do not approve solely because the code runs. If no finding remains, state any material residual risk or test gap.

### Authoritative documentation

When reviewing a change, treat the most specific applicable documentation as the source of truth:

- `docs/architecture.md` for system-wide boundaries and dependency direction.
- `docs/specs/**/specs/requirements.md`, `design.md`, and `decisions.md` for feature behavior, design, and accepted trade-offs.
- `docs/database/schema.md` for the current database model and database-level invariants.
- `docs/database/migration-rollout.md` for the mandatory expand/migrate/contract construction process.
- `docs/architecture/compatibility.md` for active N/N+1 rollout contracts and deferred cleanup.
- `docs/errors/README.md`, `docs/events/README.md`, and `docs/notifications/README.md` for platform contracts.
- `docs/platform/queue-infrastructure.md` and `docs/platform/worker-operations.md` for queue and worker reliability.
- `docs/integrations/` for consumer-facing HTTP contracts, and each domain's `reference/invariants.md` when present for business invariants.

If code contradicts an applicable documented decision in a way that can affect correctness, reliability, compatibility, or security, report it. An intentional decision change is safe only when the pull request updates the applicable specification and documentation together with the implementation and preserves a compatible migration path where required.

### Architectural boundaries

- **Context:** Changes that add or move behavior across domain, application, infrastructure, or presentation layers.
- **Invariant:** Domain code remains independent of NestJS, TypeORM, Redis, BullMQ, and HTTP. Application code orchestrates through project-owned interfaces; infrastructure and presentation contain framework adapters.
- **Violation:** Report framework imports or decorators in the domain, ORM entities escaping infrastructure, controllers containing business rules, or use cases depending directly on concrete adapters.
- **Consequence:** These dependencies reverse the intended dependency direction, couple business behavior to delivery technology, and make isolated testing or adapter replacement unsafe.
- **Safe path:** Define stable entities, value objects, errors, and ports in the inner layers; implement adapters in infrastructure and translate transport concerns at the presentation boundary or global exception filter.

### Transaction correctness

- **Context:** A business operation performs multiple database writes, enforces an invariant with read-modify-write logic, or coordinates concurrent mutations.
- **Invariant:** Writes whose partial completion would create invalid state execute atomically, and concurrency-sensitive invariants are checked inside the same transaction with the required lock or database constraint.
- **Violation:** Report removed or split transactions, repositories using a different transaction manager, checks performed only before entering the transaction, or race-prone read-then-write flows.
- **Consequence:** Crashes or concurrent requests can leave partial state, duplicate records, lost updates, or balances and ownership relationships that violate domain rules.
- **Safe path:** Use the project's transaction pattern, propagate the transaction context to every participating repository, and enforce invariants with constraints or lock-and-recheck inside the transaction.

### Durable external side effects

- **Context:** A committed database state requires a durable event, email, queue job, webhook, or other external side effect.
- **Invariant:** A crash between the database commit and dispatch must not silently lose required behavior, and retries must not produce harmful duplicates.
- **Violation:** Report independent commit-then-publish/enqueue flows with no durable intent, recovery path, or idempotency strategy when loss or duplication changes business behavior.
- **Consequence:** The database may claim an operation succeeded while consumers never observe it, or retries may repeat user-visible or financial effects.
- **Safe path:** Use the project's transactional outbox for state-derived events. For other side effects, persist an equivalent durable intent and use deterministic idempotency plus the established retry/reconciliation flow.

### Authorization and tenant isolation

- **Context:** Any read or mutation of user-owned or tenant-owned data, including indirect access through related resources.
- **Invariant:** Ownership comes from the authenticated principal and is enforced in the data-access predicate for every affected resource.
- **Violation:** Report trusting `userId` or tenant identifiers from body, query, or path input; loading or mutating by resource ID alone; or checking ownership only after data has already been exposed or changed.
- **Consequence:** An attacker can read or mutate another user's data through an IDOR or cross-tenant access path.
- **Safe path:** Derive identity from `@CurrentUser()`, carry it through the use-case input, and include it in repository queries, updates, deletes, and transaction locks.

### API and integration compatibility

- **Context:** Changes to response fields, `object` discriminators, enum values, HTTP status or headers, public error codes, event names or payloads, queue job contracts, and persisted wire formats.
- **Invariant:** Existing consumers continue to work unless the change includes an explicit, documented, and safely deployable compatibility migration.
- **Violation:** Report removed or renamed fields, changed semantics under the same identifier, unversioned event or job payload changes, and newly exposed sensitive data.
- **Consequence:** Frontends, workers, integrations, or rolling deployments can fail even when the changed service compiles and its local tests pass.
- **Safe path:** Prefer additive changes, preserve existing identifiers and semantics, centralize discriminators and codes instead of adding magic strings, and version contracts when compatibility cannot be preserved.

### Tests for changed invariants

- **Context:** A pull request adds, removes, or changes a business rule, failure mode, concurrency guarantee, migration, or public contract.
- **Invariant:** Tests demonstrate the success path and the consequential failure or boundary condition introduced by the change at the layer that can actually prove the behavior.
- **Violation:** Report happy-path-only coverage, mocks that bypass the behavior under review, missing boundary or concurrent scenarios, or assertions that do not observe the public/domain consequence.
- **Consequence:** The suite can stay green while the exact regression risk introduced by the pull request remains untested.
- **Safe path:** Keep domain tests pure, mock ports in use-case tests, use integration tests for PostgreSQL/Redis/BullMQ semantics, and use E2E tests for HTTP contracts and global error translation. Avoid timing-dependent tests.

### Migration rollout compatibility

- **Context:** A pull request adds or changes a migration that drops or renames an object, adds `NOT NULL`, changes an enum or check constraint, changes a persisted format, introduces a new required value, or removes a compatibility shim.
- **Invariant:** The migration has an explicit `expand -> migrate -> contract` rollout. It answers whether code N works after the migration and whether code N+1 works before and after it. Because production migrations are not reverted automatically, the expanded schema must preserve the image eligible for rollback.
- **Violation:** Report a migration that makes code N fail after migration, assumes an atomic migration-and-code switch, combines expansion and contract cleanup in the same rollback window, or removes a default/dual-read/dual-write compatibility mechanism without satisfying its recorded removal gate.
- **Consequence:** A deploy or application rollback can break writes, reads, startup, or workers while the database remains on the newer schema, causing an outage that green CI on code N+1 does not reveal.
- **Safe path:** Apply `migration-rollout`, split incompatible changes into separate releases, record the N/N+1 matrix and exact deferred cleanup in `docs/architecture/compatibility.md`, and execute the contract migration only after the previous image is no longer a supported rollback target.

## Code Style

- Use Conventional Commits in Portuguese with `<type>(<scope>): <description>`.
- Prefer module or bounded-context scopes, such as `feat(assets)`, `fix(auth)` and `docs(accounts)`.
- Use standard types such as `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci` and `perf`.
- Keep the description concise, lowercase, without a trailing period, and separate independent code/docs contexts into distinct commits.
- Avoid `any`.
- Handle promises deliberately; do not leave floating promises.
- Use Prettier and the repo ESLint config.
- Prefer existing project patterns and helpers over new abstractions.
