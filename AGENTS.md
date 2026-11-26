# Personal Finance Backend - Agent Instructions

## Project Overview

Multi-tenant personal finance API built with NestJS, TypeScript, PostgreSQL, Redis, and Cloudflare R2. The backend follows Clean Architecture with DDD principles and runs two separate process roles (`PROCESS_ROLE=api` and `PROCESS_ROLE=worker`).

Stack:

- Node.js 24 + NestJS 11
- PostgreSQL 16 with TypeORM 0.3
- Redis for cache/session state and dedicated Redis (`noeviction`) for BullMQ queues
- Cloudflare R2 (S3-compatible) for object storage (isolated in `assets`)
- Docker Compose for local development

Run project commands from `api/` unless the command explicitly says otherwise.

## Common Commands

```bash
npm run start:dev
npm run start:worker:dev
npm run build
npm run typecheck
npm run lint
npm run lint:check
npm run format
npm run format:check
npm run email-templates:validate
npm run test
npm run test:e2e
npm run test:integration
npm run test:cov
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

Do not generate full implementation code on the first response unless the user explicitly says `Pode codar` or `Mostre o código`. When the user asks for a concrete code change or review in an agent session, follow the newest user request and execute once intent is clear.

## Instruções do Projeto

### Arquitetura
- Preserve os limites entre módulos.
- Antes de criar dependências entre módulos, leia `docs/architecture/module-boundaries.md`.
- Não altere contratos públicos sem avaliar seus consumidores.
- Preserve a separação de processos (`PROCESS_ROLE=api` vs `PROCESS_ROLE=worker`): o worker não expõe porta HTTP e a API não executa responsabilidades exclusivas de reconciliação/consumo do worker.

### Antes de planejar, editar ou revisar
1. Identifique todos os módulos envolvidos na tarefa.
2. Procure `AGENTS.md` nos diretórios ancestrais dos arquivos-alvo, da raiz até o módulo (`api/src/modules/<modulo>/AGENTS.md`).
3. Leia os arquivos encontrados antes de propor alterações ou comentários de revisão.
4. Leia a documentação indicada pelos `AGENTS.md` locais (em `docs/<modulo>/`).
5. Se a mudança alcançar outro módulo, repita o processo nele.


### Leitura Direcionada por Pastas de Contexto (Just-in-Time Routing)
Para evitar leitura desnecessária e sobrecarga de contexto, **nunca leia todas as documentações de uma vez**. Consulte apenas a pasta de contexto correspondente ao escopo da tarefa:

| Se a tarefa envolver... | Consulte a pasta: | O que contém: |
|---|---|---|
| **Fronteiras entre módulos ou dependências** | `docs/architecture/` | Limites modulares (`module-boundaries.md`) e compatibilidade N/N+1 |
| **Banco de dados, schema, SQL ou migrations** | `docs/database/` | Schema atual (`schema.md`), rollout de migrations e convenções |
| **Workers, filas BullMQ, jobs ou concorrência** | `docs/platform/workers/` | Infraestrutura de filas, operações de worker e confiabilidade |
| **E-mails transacionais ou templates** | `docs/platform/email/` | Contratos do provedor de e-mail e configurações |
| **Pipelines de CI/CD, deploy ou GitHub Actions** | `docs/platform/ci-cd/` | Workflows de integração, entrega contínua e dependências |
| **Tratamento de datas, fusos ou instantes** | `docs/platform/dates-and-times/` | Regras para `DateOnly` vs `Instant` |
| **Contratos de resposta da API (`object`)** | `docs/platform/response-objects/` | Padrão discriminador e serialização de DTOs |
| **Logs, correlação, métricas ou alertas operacionais** | `docs/platform/observability/` | Logs estruturados Pino, correlação API/Worker, Zero-PII, métricas leves e alertas Telegram |
| **Classificação ou abertura de issues** | `docs/platform/standards/` | Padrões de issues e taxonomia da plataforma |
| **Ciclo de vida de arquivos ou storage** | `docs/assets/` e `docs/storage/` | Gerenciamento de assets, R2 público e R2 privado |
### Escopo das instruções
- Instruções locais complementam as regras globais.
- Restrições globais de segurança e limites arquiteturais não podem ser relaxadas por instruções locais.
- Se houver conflito não resolvido, informe antes de prosseguir.

### Skills do Repositório

As skills canônicas ficam em `.agents/skills/` (espelhadas em `.claude/skills/` para compatibilidade com Claude Code). Use a skill adequada ao tipo de tarefa:

- `danfy-review`: revisão geral de código/PRs (arquitetura, invariantes, contratos, testes e alinhamento/lag de documentação).
- `security-review`: revisão dedicada de segurança da aplicação em novas features, endpoints, auth, uploads, filas, configuração ou dependências.
- `database-review`: revisão dedicada de SQL, migrations, modelagem lógica PostgreSQL (3NF, FKs, índices, `CHECK`s, tipos) e comparação com o schema/migrations históricas.
- `migration-rollout`: planejamento, criação, revisão e execução de migrations compatíveis com deploy/rollback (`expand -> migrate -> contract`).
- `platform-errors`: criação, refatoração e revisão de `DomainError`, `ApplicationError` e mapeamento no `AppExceptionFilter`.
- `platform-observability`: logging estruturado, correlação, Zero-PII, `IMetricsRecorder`, alertas operacionais (`OperationalAlertService` / Telegram) e limites do `/health`.
- `spec-driven-development`: criação e manutenção de specs vivas em `docs/specs/<module>/<feature>/specs/`.
- `modular-documentation`: criação e manutenção de documentação viva em `docs/<module>/`.
- `test-suite-governance`: governança de suítes E2E e de integração (Testcontainers, CI e `docs/tests/`).
- `email-template-constructor`: criação, versionamento e validação de templates de e-mail transacional.
- `nestjs-module`, `backend-dev-env`, `danfy-issues`: criação de módulos, ambiente local e issues.

## Architecture Rules

When implementing or changing error handling, use the repo skill `platform-errors`. Domain and application errors must be framework-independent and translated to the frontend HTTP contract by the global `AppExceptionFilter`.

When documenting domain concepts, operational flows, or architectural decisions, use the repo skill `modular-documentation` and follow the living documentation standards in `docs/<module>/`.

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
│   ├── errors/
│   └── factories/
├── application/
│   ├── ports/
│   ├── errors/
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

- Domain entities, value objects, and factories must not import TypeORM decorators, ORM entities, `@nestjs/common`, `HttpException`, or infrastructure concerns. Legacy files that still throw `BadRequestException`/`ConflictException` (e.g., `users/domain`) must be migrated via `platform-errors` when touched; do not introduce new NestJS exceptions in domain code.
- Throw `DomainError` subclasses for violated domain invariants.
- Entities expose state through getters, not public mutable fields.
- Prefer `private readonly props: <Name>Props` plus `public readonly id: string`.
- Use `static create()` for validation and creation.
- Use `static reconstitute()` for trusted DB/cache hydration.
- Collections such as `authProviders` return `ReadonlyArray<T>`.
- Value objects are immutable and expose `create`, `reconstitute`, `value`, and `equals`.
- Validation constants come from `@/common/models/constants`; avoid hardcoded validation limits.
- Repository interfaces live in the domain and must not expose TypeORM APIs (except passing opaque transaction context when established by the project's `IRepositoryOptions`).

## Application Layer

- One directory per use case: `application/use-cases/<action>/`.
- Each use case directory contains `<action>.use-case.ts` and `<action>.dto.ts`.
- Use cases are `@Injectable()` classes with `execute(dto, options?)`.
- Use cases orchestrate domain and infrastructure; business rules stay in domain entities/value objects.
- Use cases inject repository interfaces or cross-module application ports, never concrete TypeORM or cached repositories.
- Use case DTOs are plain TypeScript interfaces, not `class-validator` classes.
- Throw `ApplicationError` subclasses (not NestJS `HttpException`) for orchestration failures such as not found, ownership, uniqueness, or state conflicts; let `AppExceptionFilter` translate them to HTTP.

## Infrastructure Layer

- ORM entities live in `infrastructure/persistence/`.
- ORM entity files use `<name>-orm-entity.ts` or `<name>-orm.entity.ts`.
- Sensitive fields such as `passwordHash` and `refreshTokenHash` must use `{ select: false }`.
- ORM entities are never imported outside infrastructure.
- Repositories implement domain interfaces.
- Cached repositories use the Decorator pattern around the base repository with `RedisService` (`REDIS_CLIENT`) and must bypass cache when `options?.manager` is present (active transaction).
- Cache keys must use `CacheKeys` in `@/common/utils/cache-keys.factory`.
- Default read cache TTL is 5 minutes; invalidate immediately on writes/deletes.
- Mappers live in `infrastructure/mappers/`.
- `toDomain()` uses value object `reconstitute()`, not `create()`.
- `toPersistence()` extracts primitive values from domain objects.

## Presentation Layer

- Controllers live in `presentation/http/` and stay thin.
- Controllers deserialize request, call use cases, and serialize response.
- Controllers must not contain business logic or direct repository calls.
- `ApiModule` registers 4 global `APP_GUARD`s in order: `OriginGuard` -> `JwtAuthGuard` -> `EmailVerificationStatusGuard` -> `ThrottlerGuard`. Endpoints are protected by default; bypass decorators (`@Public()`, `@SkipOriginCheck()`, `@AllowPendingEmailVerification()`, `@SkipThrottle()`) are explicit exceptions that require security review.
- Access the authenticated user with `@CurrentUser()`, never from request body, query, or params.
- Request DTOs live in `presentation/dto/` and use `class-validator` and `class-transformer` under global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- Use `@Type()` for numeric, date, and nested object fields (and `@ValidateNested()` for nested objects).
- Always return response DTOs; never expose domain entities or ORM entities directly.
- Response DTOs should declare an `object` string property that identifies the response shape for consumers. Use centralized values from `@/common/models/constants`, with keys separated by module/shape such as `transaction.list`, `transaction_summary.type`, and `account.list`. Dynamic responses must use one DTO per shape and each shape must expose its own `object`.
- Sensitive fields and tokens must never appear in response DTOs.

## Security

Authoritative baseline: `docs/security/README.md`.

- Filter all tenant/user data by `userId` from `@CurrentUser()` (JWT session), never request body/query/params, and enforce ownership on all referenced resources (direct and indirect IDOR protection).
- Store JWTs in HTTP-only cookies with rotation on refresh token use, Redis session/blacklist tracking, and `users.credential_version` invalidation on password change.
- Validate local passwords against the bcrypt 72-byte UTF-8 limit (`@IsPasswordWithinUtf8ByteLimit()`).
- Read secrets and environment values only through `ConfigService` / `api/src/config/`, never direct `process.env` in domain/application code.
- Keep rate limiting active on auth and high-cost endpoints (including dedicated cost guards / Lua scripts where established).
- Never persist secrets, raw tokens, or passwords in Transactional Outbox payloads, BullMQ jobs, or logs; never expose stack traces or raw database errors to clients.
- Isolate all object storage (Cloudflare R2 / S3 SDK) access inside `api/src/modules/assets/`; validate real file content (`file-type` / magic bytes) and generate storage keys server-side.

## Financial Domain Rules

- Never use floating-point math (`float`, `real`, `double precision`, or fractional JS `number`) for monetary values.
- Represent and persist money exclusively as safe integer cents (`amountCents`, `initialBalanceCents` validated with `Number.isSafeInteger()` in TypeScript and stored as PostgreSQL `bigint`).
- Transaction `amountCents` is always strictly positive (`> 0`); financial direction is determined by `type` (`INCOME`, `EXPENSE`, `TRANSFER`, `ADJUSTMENT`) and `direction` (`INCREASE`/`DECREASE` for `ADJUSTMENT`), never by a negative amount.
- Account balance is derived from `initialBalanceCents` plus `EFFECTIVE`, non-deleted transactions (`deleted_at IS NULL`); accounts do not store a mutable balance column.
- Transaction statuses are `PENDING` (does not affect current balance, `effectiveAt` is null) and `EFFECTIVE` (affects current balance, `effectiveAt` is set).
- Deleting common transactions uses soft delete (`deleted_at`); deleting `TRANSFER` transactions is forbidden in V0 (enforced in domain and DB via `CHK_transactions_transfer_not_deleted`).

## Temporal Data Rules

- Separate `DateOnly` from `Instant`.
- `DateOnly` is a civil date string in `YYYY-MM-DD`, with no time and no timezone. Examples: `transactions.date`, `dateFrom`, `dateTo`, `projectedUntil`.
- Do not convert `DateOnly` to JavaScript `Date`; do not serialize it with `toISOString().slice(0, 10)`.
- Persist `DateOnly` values in PostgreSQL `date` columns by sending the `YYYY-MM-DD` string.
- `Instant` is an exact point in time. Examples: `createdAt`, `updatedAt`, `effectiveAt`, `deletedAt`, `occurredAt`.
- Persist `Instant` values in PostgreSQL `timestamptz` columns and expose them as ISO 8601 UTC.
- Frontend clients may convert `Instant` values to the user's local timezone for display, but must not timezone-shift `DateOnly` values.

## Testing

Follow `test-suite-governance` whenever creating, changing, renaming, or removing E2E or integration tests.

- Domain tests are pure Node.js tests. Do not instantiate Nest `TestingModule` for entities or value objects.
- Use case tests use `@nestjs/testing` and mock repository interfaces/ports, not concrete repositories.
- Verify repository `save()` receives a domain entity, not primitive data.
- Integration tests (`api/test/*.integration-spec.ts`) run against real disposable infrastructure using **Testcontainers** (`@testcontainers/postgresql`, `@testcontainers/redis`, `@testcontainers/toxiproxy`) — do not use SQLite in-memory fakes for PostgreSQL behavior.
- Unit tests for cached repositories mock `RedisService` / `REDIS_CLIENT`.
- Controller E2E tests (`api/test/*.e2e-spec.ts`) use supertest against the Nest app without requiring Docker/external infra.
- Coverage targets: 90% for domain and application use cases, 70% for infrastructure.
- Use one root `describe` per spec file, nested `describe` blocks per method/scenario, and `jest.clearAllMocks()` in `beforeEach`.
- No tests should rely on `setTimeout` or execution order.

## Migrations

Always create a TypeORM migration for schema changes:

Before planning, creating, generating, reviewing, or running a migration, use the repository skills `migration-rollout` and `database-review`. Their `expand -> migrate -> contract` workflow, `docs/database/migration-rollout.md`, `docs/database/review-guidelines.md`, and `docs/architecture/compatibility.md` are mandatory for migration work.

Before creating, generating, or running any migration, read `docs/database/schema.md` and the relevant existing migrations in `api/src/database/migrations/` to understand current tables, indexes, triggers, functions, enums, and naming conventions. Reuse existing database objects (`set_updated_at()`, `gen_random_uuid()`, existing enums) when appropriate; do not create duplicate functions/triggers or introduce overlapping infrastructure objects.

1. Modify the ORM entity.
2. Generate or create the migration.
3. Review generated SQL in `api/src/database/migrations/` against `docs/database/review-guidelines.md` and `docs/database/migration-rollout.md`.
4. Update `docs/database/schema.md` whenever the migration creates, drops, renames, or changes any table, column, constraint, index, trigger, function, enum, or database-level invariant, and update `docs/architecture/compatibility.md` whenever a temporary shim or contract gate is created or retired.
5. Run and validate the migration in real PostgreSQL.

Never ship entity schema changes without a migration. Never modify applied migrations; create a new migration to revert or adjust.

## Code Review Rules

Passing builds, tests, lint, and type checks is necessary but not sufficient for approval. Review the changed behavior against every applicable invariant in this file, the local `api/src/modules/<module>/AGENTS.md` files for touched modules, and the authoritative documentation below. Focus findings on correctness, reliability, compatibility, security, logical database design, documentation drift, and consequential maintainability risks introduced by the pull request; leave formatting and other deterministic checks to CI.

For every finding:

- Identify the affected file and line, the violated invariant or authoritative document, and an observable failure scenario.
- Explain the consequence and provide a safe implementation path.
- Assign priority (**P0** merge-blocker, **P1** important fix, **P2** relevant risk/gap) from impact and reachability, not preference. Do not report speculative issues without a concrete path to failure or preference-only nits when the implementation follows a documented safe path.
- Respect explicitly documented technical debt (`DT-01`, `DT-02`, `DT-03` in `docs/architecture/module-boundaries.md`) in untouched legacy code, but flag any **new** violation introduced by the diff.
- Do not approve solely because the code runs. If no finding remains, state any material residual risk, test gap, or documentation check performed.

### Authoritative documentation

When reviewing a change, treat the most specific applicable documentation as the source of truth:

- `api/src/modules/<module>/AGENTS.md` for module-specific boundaries and invariants.
- `docs/architecture.md` and `docs/architecture/module-boundaries.md` for system-wide boundaries, process roles, dependency direction, and tolerated exceptions.
- `docs/security/README.md` for technical security controls, guard chain, bypass rules, and threat model.
- `docs/specs/**/specs/requirements.md`, `design.md`, and `decisions.md` for feature behavior, design, and accepted trade-offs.
- `docs/database/schema.md` for the current database model and database-level invariants.
- `docs/database/review-guidelines.md` for SQL, logical database design, and historical migration alignment.
- `docs/database/migration-rollout.md` for the mandatory `expand -> migrate -> contract` rollout process.
- `docs/architecture/compatibility.md` for active N/N+1 rollout contracts and deferred cleanup.
- `docs/errors/README.md`, `docs/events/README.md`, and `docs/notifications/README.md` for platform contracts.
- `docs/platform/workers/`, `docs/platform/response-objects/`, and `docs/platform/dates-and-times/` for platform reliability and contracts.
- `docs/tests/README.md` for test suite governance and CI dependencies.
- `docs/integrations/` for consumer-facing HTTP contracts, and each domain's `docs/<module>/` (`concepts/`, `flows/`, `decisions/`, `reference/invariants.md`) for business invariants.

If code contradicts an applicable documented decision in a way that can affect correctness, reliability, compatibility, or security, report it. An intentional decision change is safe only when the pull request updates the applicable specification and documentation together with the implementation and preserves a compatible migration path where required.

### Architectural boundaries

- **Context:** Changes that add or move behavior across domain, application, infrastructure, presentation, modules, or `API`/`Worker` process roles.
- **Invariant:** Domain code remains independent of NestJS, TypeORM, Redis, BullMQ, and HTTP (`DomainError` only). Application code orchestrates via domain repositories or cross-module application ports (`ApplicationError` only). Infrastructure and presentation contain framework adapters. Modules do not mutate tables of other modules or access R2 outside `assets`.
- **Violation:** Report new framework imports/decorators or `HttpException` in domain/use cases, ORM entities escaping infrastructure, controllers containing business rules, use cases depending on concrete adapters or new cross-module internal repositories, direct R2 calls outside `assets`, or API/Worker role leakage.
- **Consequence:** Reverses dependency direction, couples business behavior to delivery technology, breaks module isolation, and makes isolated testing or independent API/Worker scaling unsafe.
- **Safe path:** Define entities, value objects, errors, and ports in inner layers; use public application ports or outbox events across modules; implement adapters in infrastructure and translate transport errors in `AppExceptionFilter`. Tolerated exceptions (`*OrmEntity` `@ManyToOne`/`@OneToMany` relations, existing `DT-01..03`) are listed in `docs/architecture/module-boundaries.md`.

### SQL and logical database design

- **Context:** Any PR that adds or alters migrations (`api/src/database/migrations/`), ORM entities (`*-orm.entity.ts`), `sql/` scripts, or SQL/TypeORM queries (`queryRunner.query`, `manager.query`, `createQueryBuilder`). Apply skill `database-review`.
- **Invariant:** Every schema change aligns with `docs/database/schema.md` and existing migrations (reusing `set_updated_at()`, `gen_random_uuid()`, naming conventions `PK_`/`FK_`/`UQ_`/`CHK_`/`idx_`/`trg_`), follows sound PostgreSQL 16 logical modeling (3NF, explicit PK/FK with appropriate `ON DELETE`, indexes on FKs, DB-level `CHECK`s for row invariants, partial `UNIQUE`s for soft-delete/multi-tenant scopes, `bigint` cents, `date` vs `timestamptz`, `jsonb`), and keeps SQL queries parameterized and transaction-aware.
- **Violation:** Report schema drift between ORM entity, migration, and `docs/database/schema.md`; duplicated helper functions/triggers; missing FK constraints or missing indexes on FK/hot tenant predicates; missing `CHECK`s for critical row invariants; `UNIQUE` indexes that ignore `deleted_at IS NULL` or `user_id` scoping; float/timestamp-without-tz types; unparameterized SQL or unvalidated dynamic `ORDER BY`; or unassessed `ACCESS EXCLUSIVE` locks on populated tables.
- **Consequence:** Silent data corruption, cross-tenant collisions, broken soft-delete semantics, severe query/delete degradation, lock queues causing downtime, or SQL injection.
- **Safe path:** Compare every SQL change against `docs/database/schema.md` and prior migrations of the module, apply `docs/database/review-guidelines.md`, protect invariants with PostgreSQL constraints and indexes, use `CONCURRENTLY`/`NOT VALID` + batched backfills on hot tables, and parameterize all queries.

### Security and tenant isolation

- **Context:** Any new feature, endpoint, guard/decorator change, read/mutation of user-owned data, auth/session/OAuth flow, file upload/asset handling, async payload, configuration, or dependency/CI change. Apply skill `security-review` and `docs/security/README.md`.
- **Invariant:** Endpoints stay protected by the global guard chain (`OriginGuard -> JwtAuthGuard -> EmailVerificationStatusGuard -> ThrottlerGuard`); ownership comes exclusively from `@CurrentUser()` and is enforced on both target and referenced resources (direct and indirect IDOR); inputs prevent mass assignment (BOPLA) and resource abuse; secrets/tokens/PII never leak into responses, logs, outbox, or BullMQ; object storage stays isolated in `assets`.
- **Violation:** Report unjustified `@Public()`, `@SkipOriginCheck()`, `@AllowPendingEmailVerification()`, or `@SkipThrottle()`; trusting `userId` from body/query/params; loading/mutating by ID alone or linking another user's `accountId`/`categoryId`/`assetId`/`templateId`; allowing users to mutate institutional/system resources; DTOs accepting server-controlled fields or unbounded arrays/pagination; missing `file-type` magic-byte validation; tokens/secrets in outbox/BullMQ/logs; raw `process.env` outside `config/`; or unsafe CORS/Helmet/dependency/workflow changes.
- **Consequence:** Unauthorized access, IDOR/cross-tenant data breach, CSRF/session hijack, privilege escalation, DoS, or credential/PII disclosure.
- **Safe path:** Keep global guards intact, derive identity from `@CurrentUser()`, verify ownership of all direct and referenced entities in data-access predicates/transactions, use strict Request/Response DTOs with centralized constants, sanitize uploads in `assets`, and keep async payloads and logs secret-free.

### Transaction correctness

- **Context:** A business operation performs multiple database writes, enforces an invariant with read-modify-write logic, or coordinates concurrent mutations.
- **Invariant:** Writes whose partial completion would create invalid state execute atomically, concurrency-sensitive invariants are checked inside the same transaction with the required lock or database constraint, and cached repositories bypass cache when a transaction `manager` is active.
- **Violation:** Report removed or split transactions, repositories using a different `EntityManager`, cached reads returning stale state inside a transaction, checks performed only before entering the transaction, or race-prone read-then-write flows.
- **Consequence:** Crashes or concurrent requests can leave partial state, duplicate records, lost updates, or balances and ownership relationships that violate domain rules.
- **Safe path:** Propagate `options.manager` to every participating repository, bypass cache when `options?.manager` is present, and enforce invariants with constraints or lock-and-recheck (`FOR UPDATE` / `SKIP LOCKED`) inside the transaction.

### Durable external side effects

- **Context:** A committed database state requires a durable event, email, queue job, object-storage cleanup, webhook, or other external side effect.
- **Invariant:** A crash between the database commit and dispatch must not silently lose required behavior, and retries must not produce harmful duplicates.
- **Violation:** Report independent commit-then-publish/enqueue flows or direct R2/email calls inside API request transactions with no durable intent, recovery/reconciliation path, or idempotency strategy when loss or duplication changes business behavior.
- **Consequence:** The database may claim an operation succeeded while consumers never observe it, orphaned files/emails accumulate, or retries repeat user-visible or financial effects.
- **Safe path:** Use the project's Transactional Outbox for state-derived events, `DELETE_PENDING` + `AssetReconcilerService` for R2 deletion, and persisted intent (`email_messages`) + deterministic idempotency + reconciler for queue jobs.

### API and integration compatibility

- **Context:** Changes to response fields, `object` discriminators, enum values, HTTP status or headers, public error codes, event names or payloads, queue job contracts, and persisted wire formats.
- **Invariant:** Existing consumers continue to work unless the change includes an explicit, documented, and safely deployable compatibility migration.
- **Violation:** Report removed or renamed fields, changed semantics under the same identifier, unversioned event or job payload changes, missing/inconsistent `object` discriminators, and newly exposed sensitive data.
- **Consequence:** Frontends, workers, integrations, or rolling deployments can fail even when the changed service compiles and its local tests pass.
- **Safe path:** Prefer additive changes, preserve existing identifiers and semantics, centralize discriminators and error codes instead of adding magic strings, and version contracts when compatibility cannot be preserved.

### Avoidable magic strings

- **Context:** Changes that introduce or modify string literals across domain, application, infrastructure, presentation, queues, observability, configuration, or tests.
- **Invariant:** The project requires as few magic strings as possible. Any string literal that is reused or has clear potential for reuse across layers, modules, services, filters, queues, contracts, or tests — such as log/domain event names, error codes, severities, statuses, types/categories, header names, Redis key prefixes, queue/job names, `object` discriminators, alert keys, or sentinel values like `[REDACTED]` — MUST be centralized in typed constants (`as const`) or dedicated enums (`constants/` or `enums/`), never duplicated inline.
- **Violation:** Report avoidable magic strings as **P1** when they involve a contract, event, error code, header, Redis key, or value repeated across multiple files with risk of silent drift, or **P2** when easily reusable/centralizable to preserve consistency and safe refactoring. Do not generate noise over reasonable exceptions: single-use descriptive human messages or test-only text with no shared contract.
- **Consequence:** Silent contract or key drift across API, Worker, and tests, missed TypeScript type checking, and fragile refactors.
- **Safe path:** Extract shared literals into typed constants (`as const`) or dedicated enums (`constants/` or `enums/`, `@/common/models/constants`, or `CacheKeys`), and import those symbols everywhere they are used or asserted.

### Migration rollout compatibility

- **Context:** A pull request adds or changes a migration that drops or renames an object, adds `NOT NULL`, changes an enum or check constraint, changes a persisted format, introduces a new required value, or removes a compatibility shim.
- **Invariant:** The migration has an explicit `expand -> migrate -> contract` rollout. It answers whether code N works after the migration and whether code N+1 works before and after it. Because production migrations are not reverted automatically, the expanded schema must preserve the image eligible for rollback.
- **Violation:** Report a migration that makes code N fail after migration, assumes an atomic migration-and-code switch, combines expansion and contract cleanup in the same rollback window, modifies an applied migration, or removes a default/dual-read/dual-write compatibility mechanism without satisfying its recorded removal gate in `docs/architecture/compatibility.md`.
- **Consequence:** A deploy or application rollback can break writes, reads, startup, or workers while the database remains on the newer schema, causing an outage that green CI on code N+1 does not reveal.
- **Safe path:** Apply `migration-rollout`, split incompatible changes into separate releases, record the N/N+1 matrix and exact deferred cleanup in `docs/architecture/compatibility.md`, and execute the contract migration only after the previous image is no longer a supported rollback target.

### Documentation and specification alignment

- **Context:** Any PR that introduces or changes business rules, endpoints/HTTP contracts, error codes, domain events/queues, database schema/migrations/compatibility shims, environment variables, process/CI behavior, module boundaries, or E2E/integration test suites.
- **Invariant:** Living documentation and specs stay synchronized with the changed implementation in the same PR so future changes and reviews never operate on stale truth.
- **Violation:** Report **missing documentation** (e.g., new feature/rule without spec or domain doc, new public error code/event/env var undocumented) or **documentation lag/drift** where changed code now contradicts existing `docs/<module>/`, `docs/specs/**/specs/`, `docs/database/schema.md`, `docs/architecture/compatibility.md`, `docs/architecture/module-boundaries.md`, `docs/errors/`, `docs/events/`, `docs/integrations/`, `docs/configuration.md`, `.env.exemple`, `docs/tests/`, or `api/src/modules/<module>/AGENTS.md`. Do not report cosmetic doc nits for purely internal refactors that preserve all observable behavior and contracts.
- **Consequence:** Stale documentation misleads both human maintainers and AI agents, causing future regressions, broken frontend/worker contracts, and invalid migration assumptions.
- **Safe path:** Compare the diff against every affected doc and spec before approval; update living docs (`status: current`) and active specs in the same PR, and mark superseded docs as `historical`/`deprecated` with `superseded_by` when replacing an older design.

### Tests for changed invariants

- **Context:** A pull request adds, removes, or changes a business rule, failure mode, security check, concurrency guarantee, migration, or public contract.
- **Invariant:** Tests demonstrate the success path and the consequential failure or boundary condition introduced by the change at the layer that can actually prove the behavior.
- **Violation:** Report happy-path-only coverage, mocks that bypass the behavior under review, missing security/ownership rejection tests, missing boundary or concurrent scenarios, or assertions that do not observe the public/domain consequence.
- **Consequence:** The suite can stay green while the exact regression or security risk introduced by the pull request remains untested.
- **Safe path:** Keep domain tests pure, mock ports in use-case tests, use Testcontainers integration tests for PostgreSQL/Redis/BullMQ semantics, and use E2E tests for HTTP contracts, guards, and `AppExceptionFilter` translation. Avoid timing-dependent tests.

## Code Style

- Use Conventional Commits in Portuguese with `<type>(<scope>): <description>`.
- Prefer module or bounded-context scopes, such as `feat(assets)`, `fix(auth)` and `docs(accounts)`.
- Use standard types such as `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci` and `perf`.
- Keep the description concise, lowercase, without a trailing period, and separate independent code/docs contexts into distinct commits.
- Avoid `any`.
- Handle promises deliberately; do not leave floating promises.
- Use Prettier and the repo ESLint config.
- Prefer existing project patterns and helpers over new abstractions.
- Avoid reusable or potentially reusable magic strings; centralize shared literals in typed constants (`as const`) or enums.
