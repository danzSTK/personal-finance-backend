# Personal Finance Backend - Copilot Instructions

## Project Overview
Multi-tenant personal finance API built with NestJS, TypeScript, PostgreSQL, and Redis. Implements Clean Architecture with DDD principles.

**Stack:**
- Node.js 22 + NestJS 11
- PostgreSQL (via TypeORM 0.3)
- Redis (cache + session management)
- Docker Compose for local development

---

## Build, Test, and Lint Commands

All commands run from `api/` directory:

```bash
# Development
npm run start:dev          # Watch mode with hot reload
npm run start:debug        # Debug mode with inspector

# Build & Production
npm run build              # Compile TypeScript
npm run start:prod         # Run compiled dist/main.js

# Testing
npm run test               # Run all unit tests (Jest)
npm run test:watch         # Watch mode
npm run test:e2e           # E2E tests (test/jest-e2e.json)
npm run test:cov           # Coverage report
npm run test -- --testNamePattern="create user"  # Run specific test

# Linting & Formatting
npm run lint               # ESLint with auto-fix
npm run format             # Prettier write

# TypeORM Migrations
npm run migration:generate --name=AddColumnX   # Generate from entity changes
npm run migration:create --name=CustomMigration # Create empty migration
npm run migration:run      # Apply pending migrations
npm run migration:revert   # Rollback last migration
npm run migration:show     # Show migration status

# Production migrations (from dist/)
npm run migration:run:prod
```

**Docker:**
```bash
docker compose up -d       # Start all services (from backend root)
docker compose logs -f api # Follow API logs
docker compose down        # Stop all services
```

---

## Architecture Overview

### Layered Module Structure (DDD + Clean Architecture)

Each domain module (`api/src/modules/<domain>/`) follows strict layer separation:

```
modules/<domain>/
├── domain/                      # Core business logic (framework-agnostic)
│   ├── entities/                # Domain entities with business rules
│   ├── value-objects/           # Immutable VOs (Email, Money, etc.)
│   ├── repositories/            # Repository interfaces (IUserRepository)
│   └── factories/               # Complex entity creation logic
├── application/                 # Use cases orchestration
│   └── use-cases/<action>/
│       ├── <action>.use-case.ts # Orchestrates domain + infrastructure
│       └── <action>.dto.ts      # Simple TS interfaces (not class-validator)
├── infrastructure/              # External dependencies
│   ├── persistence/
│   │   ├── <entity>-orm.entity.ts      # TypeORM entity (persistence)
│   │   ├── <entity>.repository.ts      # Concrete implementation
│   │   └── cached-<entity>.repository.ts # Decorator with Redis cache
│   └── mappers/                 # Domain ↔ ORM conversion
└── presentation/                # HTTP layer
    ├── http/                    # Controllers (thin, no business logic)
    └── dto/                     # Request/response DTOs (class-validator)
```

**Key Architectural Rules:**

1. **Domain Layer is Pure:**
   - NO imports of `@nestjs/common`, `HttpException`, or TypeORM decorators
   - Business rules live in entities/VOs, NOT in use cases
   - Uses domain exceptions (future: migrate from `BadRequestException`)

2. **Use Cases Orchestrate:**
   - Inject `IRepository` interfaces (never concrete implementations)
   - Can throw NestJS exceptions (`ConflictException`, etc.)
   - Return domain entities, not ORMs

3. **Controllers Are Thin:**
   - Deserialize request → call use case → serialize response
   - NO repository access, NO business logic
   - All endpoints use `@UseGuards(JwtAuthGuard)` unless marked `@Public()`
   - Extract user via `@CurrentUser()` decorator, NEVER from request body

4. **Mappers Bridge Layers:**
   - `toDomain(ormEntity)`: Uses `.reconstitute()` on VOs (no validation)
   - `toPersistence(domainEntity)`: Extracts primitive values from VOs

---

## Module Conventions

### Path Alias
All imports use `@/` alias (maps to `src/`):
```typescript
import { Email } from '@/modules/users/domain/value-objects/email.value-object';
```

### Repository Pattern with Caching
Two implementations per repository:
- `<entity>.repository.ts`: Direct TypeORM access
- `cached-<entity>.repository.ts`: Decorator pattern wrapping base + Redis cache

Module binds the active implementation:
```typescript
providers: [
  { provide: 'IUserRepository', useClass: CachedUserRepository }
]
```

**Cache Key Factory:**
Use `@/common/utils/cache-key-factory.ts` for consistent key generation:
```typescript
import { createCacheKey } from '@/common/utils/cache-key-factory';
const key = createCacheKey('user', 'email', email); // "user:email:foo@bar.com"
```

**Cache Strategy:**
- TTL: 5 minutes for reads
- Invalidation: Immediate on writes (save/update/delete)
- Use `REDIS_CLIENT` (ioredis) for complex ops (sets, pipelines)
- Use `CACHE_MANAGER` for simple key-value

---

## Security Requirements

**Authentication & Authorization:**
- JWT tokens stored in HTTP-only cookies
- Refresh tokens with rotation on use
- Redis blacklist for logout/password-change invalidation
- Session tracking: device metadata + IP geolocation (via `session-metadata.service`)

**Critical Rules:**
- Filter data by `userId` from JWT payload, NEVER from request body
- Sensitive fields (`passwordHash`, `refreshTokenHash`) have `{ select: false }` in ORM
- OAuth secrets only in environment variables (via `ConfigService`)
- Rate limiting via `@nestjs/throttler` on auth endpoints
- Never expose stack traces or DB errors to clients

---

## Value Objects Pattern

All VOs follow this structure:
```typescript
export class Email {
  private constructor(private readonly _value: string) {}

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();
    if (!isValidEmail(normalized)) throw new BadRequestException('Invalid email');
    return new Email(normalized);
  }

  static reconstitute(raw: string): Email {
    return new Email(raw); // No validation (from DB)
  }

  get value(): string { return this._value; }

  equals(other: Email): boolean {
    return this._value === other._value;
  }
}
```

**Rules:**
- Immutable: no setters
- `create()`: validates & normalizes
- `reconstitute()`: trusted deserialization (DB/cache)
- Use constants from `@/common/models/constants` for validation rules

---

## Testing Strategy

**Domain Tests (Pure Node.js):**
```typescript
// NO @nestjs/testing — test entities/VOs in isolation
describe('Email VO', () => {
  describe('create()', () => {
    it('should normalize to lowercase');
    it('should reject invalid format');
  });
  
  describe('equals()', () => {
    it('should return true for identical emails');
  });
});
```

**Use Case Tests (With Mocks):**
```typescript
const mockRepo: jest.Mocked<IUserRepository> = {
  findByEmail: jest.fn(),
  save: jest.fn(),
};

beforeEach(async () => {
  const module = await Test.createTestingModule({
    providers: [
      CreateUserUseCase,
      { provide: 'IUserRepository', useValue: mockRepo },
    ],
  }).compile();
  // ...
});

it('should throw ConflictException if email exists', async () => {
  mockRepo.findByEmail.mockResolvedValue(existingUser);
  await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
});
```

**Coverage Targets:**
- Domain + Use Cases: 90%
- Infrastructure: 70%

---

## TypeORM Migrations Workflow

**Always create a migration for schema changes:**
```bash
# 1. Modify ORM entity (add/remove column)
# 2. Generate migration
npm run migration:generate --name=AddUserAvatar

# 3. Review generated SQL in src/database/migrations/
# 4. Run migration
npm run migration:run
```

**Never:**
- Push entity changes without migration
- Modify applied migrations (create new one to revert)

---

## Redis Usage Patterns

**Session Management (REDIS_CLIENT - ioredis):**
```typescript
// Whitelist pattern for JWT
await redisClient.sadd(`user:${userId}:sessions`, jti);
await redisClient.expire(`user:${userId}:sessions`, refreshTokenTTL);

// Blacklist on logout
await redisClient.srem(`user:${userId}:sessions`, jti);
```

**Response Caching (CACHE_MANAGER):**
```typescript
@Injectable()
export class CachedUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const key = createCacheKey('user', 'email', email);
    const cached = await this.cache.get<User>(key);
    if (cached) return cached;
    
    const user = await this.baseRepo.findByEmail(email);
    if (user) await this.cache.set(key, user, 300); // 5min TTL
    return user;
  }
}
```

---

## Financial Domain Rules

**Monetary Precision:**
- Use `decimal.js` or `big.js` for all money calculations
- NEVER use JavaScript `number` for currency amounts
- Store as integer cents in DB (e.g., $10.50 → 1050)

**Transaction Integrity:**
- Every transaction MUST have: `userId`, `categoryId`, `accountId`, `date`
- Validate account balance before debits (return `400 Bad Request`)
- Reconciled transactions are immutable (return `409 Conflict` on edit attempts)

---

## Environment Configuration

**Always use `ConfigService`:**
```typescript
constructor(private readonly config: ConfigService) {}

const dbHost = this.config.get<string>('POSTGRES_HOST'); // ✅
const dbHost = process.env.POSTGRES_HOST; // ❌ Never
```

**Docker networking:**
- Inside containers: use service names (`POSTGRES_HOST=db`, `REDIS_HOST=redis`)
- Host machine: use `localhost`

---

## Code Style & Commits

**Conventional Commits (Portuguese):**
```
feat(auth): adiciona login com Google OAuth
fix(transactions): corrige cálculo de saldo negativo
refactor(users): move validação para value object
test(auth): adiciona testes para refresh token
```

**ESLint Rules:**
- `no-explicit-any`: error
- `no-floating-promises`: warn
- Prettier with `endOfLine: auto`
- Path imports must use `@/` alias (no `src/*`)

---

## Persona & Interaction Protocol

Responda **em Português**. Ao receber um pedido de funcionalidade:

1. **O PLANO:** Descreva a arquitetura (quais camadas/componentes)
2. **O PORQUÊ:** Justifique escolhas e trade-offs
3. **O COMO:** Explique conceitualmente (design patterns, fluxo de dados)
4. **VALIDAÇÃO:** Pergunte se faz sentido antes de codar

**Gatilho para código:** Aguarde "Pode codar" ou "Mostre o código" antes de gerar implementação completa.

---

## Additional Resources

- **Detailed layer rules:** `.github/instructions/` (modules-domain, modules-application, etc.)
- **Architecture docs:** `docs/auth/auth.v2.md`, `docs/deploy.md`
- **NestJS docs:** https://docs.nestjs.com
- **TypeORM migrations:** https://typeorm.io/migrations
