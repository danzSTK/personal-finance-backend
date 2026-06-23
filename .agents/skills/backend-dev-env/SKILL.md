---
name: backend-dev-env
description: Run and verify this repository's backend development environment. Use when the user asks to start the API locally, run the backend in watch mode, check the dev environment, verify PostgreSQL/Redis dependencies, run migrations, or diagnose boot problems for this NestJS backend.
---

# Backend Development Environment

## Stack

Run the API locally in watch mode. Do not start the API container for normal dev work.

The backend is sustained by:

- NestJS API on Node.js 22.
- PostgreSQL 16 in Docker.
- Redis 7 Alpine in Docker.
- Root `.env` loaded from commands run inside `api/`.

## Run Locally

From the repository root, start only infrastructure:

```bash
docker compose up -d postgres redis
docker compose ps
```

Expected containers:

- `personal-finance-db` healthy on port `5432`.
- `personal-finance-redis` healthy on port `6379`.

From `api/`, activate Node through nvm before using npm:

```bash
source ~/.nvm/nvm.sh
nvm use
node --version
npm --version
```

Expected version source:

- `api/.nvmrc` contains `22`.
- `package.json` requires Node `^22.0.0` and npm `>=10.0.0`.

Validate before starting watch when practical:

```bash
npm run build
npm run migration:show
```

Run the API locally in watch mode:

```bash
npm run start:dev
```

Success looks like:

- TypeScript watch compilation reports `Found 0 errors`.
- Nest logs `Nest application successfully started`.
- `AccountsController` routes are mapped.
- Port `3000` is served by a local `node` process, not an API container.

## Verify Health

Call health endpoints:

```bash
curl -i http://localhost:3000/health/liveness
curl -i http://localhost:3000/health/readiness
```

Expected readiness details:

- `postgres.status` is `up`.
- `redis.status` is `up`.
- `memory_heap.status` is `up`.

## Environment Notes

- The root `.env` is required. The example file is `.env.exemple`.
- `ConfigModule` and TypeORM `data-source.ts` load `.env` using `join(process.cwd(), '..', '.env')`, so run npm commands from `api/`.
- TypeORM uses `synchronize: false`; use migrations for schema changes.
- Docker Compose applies `docker-compose.override.yml` automatically in local dev, which adds PostgreSQL to the base Compose stack.
- If `npm` is not found, run `source ~/.nvm/nvm.sh && nvm use` inside `api/`.
- If local network or Docker commands fail in sandboxed execution, retry with the needed permission rather than changing the workflow.

## Common Commands

Run from `api/` after `nvm use`:

```bash
npm run build
npm run lint
npm run test
npm run test:e2e
npm run migration:run
npm run migration:show
npm run migration:generate --name=MigrationName
npm run migration:revert
```
