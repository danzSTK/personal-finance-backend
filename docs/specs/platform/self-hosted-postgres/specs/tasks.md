---
area: platform
feature: self-hosted-postgres
type: spec-tasks
status: current
related:
  - ./requirements.md
  - ./design.md
  - ./decisions.md
---

# PostgreSQL Auto-Hospedado — Tarefas

## Backend

- [x] 1. Criar `postgres-ssl.ts` com `parsePostgresSslFlag` e `resolvePostgresSsl`, com testes unitários.
- [x] 2. Expor `ssl` em `database.config.ts` e declarar `POSTGRES_SSL` no schema Joi.
- [x] 3. Usar o helper em `createPostgresOptions` e em `data-source.ts`, atualizando `postgres.module.spec.ts`.
- [x] 4. Cobrir a validação de `POSTGRES_SSL` inválido.
- [x] 5. Documentar `POSTGRES_SSL` em `docs/configuration.md` e `.env.exemple`.
- [x] 6. Atualizar `docs/deploy.md` e `README.md` para o PostgreSQL no Compose.
- [x] 7. Registrar o contrato e o limite de rollback em `docs/architecture/compatibility.md`.
- [x] 8. Indexar a spec em `docs/specs/README.md`.
- [x] 9. Validar `format:check`, `lint:check`, `typecheck`, `build`, testes unitários e E2E.
- [x] 10. Provar as migrations do zero em PostgreSQL 16.13 sem TLS, usando `dist`.
- [x] 11. Abrir a PR para `develop` e aguardar o CI.

## danfy-infra

- [x] 12. Adicionar o serviço `postgres`, o volume e as dependências ao Compose de produção.
- [x] 13. Fixar `POSTGRES_HOST`, `POSTGRES_PORT` e `POSTGRES_SSL` no ambiente compartilhado de API e worker.
- [x] 14. Incluir `postgres` em `start_dependencies` do executor.
- [x] 15. Estender o teste do executor para provar que o PostgreSQL sobe antes das migrations.
- [x] 16. Atualizar `README.md` e `docs/runbooks/backend-deploy.md`.
- [x] 17. Validar Bash, ShellCheck, testes do executor e `docker compose config`.
- [x] 18. Abrir a PR e aguardar o Infra CI.

## Integração e VM

- [x] 19. Mergear as PRs do backend e do `danfy-infra`.
- [x] 20. Instalar Compose e executor na VM e atualizar `backend.env`, preservando backup do estado anterior.
- [x] 21. Subir `postgres` e validar o healthcheck e o `StartedAt`.
- [x] 22. Resetar os volumes dos dois Redis.
- [x] 23. Promover `develop` para `main` por PR e deixar a release incluir a mudança.
- [x] 24. Acompanhar o Backend CD e validar readiness local e pública, `health:worker` e a estabilidade do container `postgres`.

## Acompanhamento recomendado

Estas tarefas não bloqueiam a restauração, mas o PostgreSQL local não tem os backups automáticos do RDS.

- [ ] 25. Backup diário com `pg_dump`, retenção local, cópia criptografada para o bucket privado do R2 e teste de restore.
- [ ] 26. Política de backup do boot volume na Oracle.
- [ ] 27. Role de aplicação sem privilégio de superusuário.
- [ ] 28. Issue para o filtro global que devolve 500 em vez de 503 em `/health/readiness`.
