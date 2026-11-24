---
name: database-review
description: Revisao dedicada de SQL, migrations TypeORM, ORM entities, modelagem logica PostgreSQL (3NF, chaves, FKs, indices, CHECKs, tipos) e comparacao com o schema e migrations historicas da Danfy. Use sempre que uma mudanca tocar migrations, entidades ORM, scripts em sql/ ou queries SQL/TypeORM.
---

# Database Review

Auditoria tecnica de SQL, migrations e modelagem logica PostgreSQL 16 para o backend Danfy, compativel com Codex e Claude Code.

Esta skill atua em conjunto com `migration-rollout`: enquanto `migration-rollout` governa a compatibilidade de deploy e rollback (`expand -> migrate -> contract`), `database-review` avalia **coerencia com o banco atual e migrations historicas**, **qualidade de modelagem logica**, **risco operacional de locks** e **seguranca/corretude de queries SQL**.

## Fontes Obrigatorias Antes de Revisar

Nunca avalie SQL isoladamente. Leia antes:

1. `docs/database/schema.md` — estado atual das tabelas, constraints, indices, triggers, funcoes e enums;
2. `docs/database/review-guidelines.md` — diretrizes autoritativas de SQL e modelagem logica;
3. `api/src/database/migrations/` — migrations mais recentes e migrations historicas das tabelas tocadas (para entender convencoes reais, nomes, triggers e constraints ja existentes);
4. `docs/database/migration-rollout.md` e `docs/architecture/compatibility.md` — shims ativos, gates e regras N/N+1;
5. ORM entities (`*-orm.entity.ts` / `*-orm-entity.ts`) e a spec da feature em `docs/specs/`.

## Fluxo de Revisao em 4 Etapas

### Etapa 1 — Comparacao com o Schema e Migrations Historicas
- Verifique se o SQL reutiliza objetos existentes (`set_updated_at()`, `gen_random_uuid()`, enums existentes) em vez de duplicar funcoes ou triggers.
- Valide a aderencia as convencoes de nomes do projeto (`snake_case`, `PK_`, `FK_`, `UQ_`, `CHK_`, `idx_`, `trg_<table>_updated_at`).
- Verifique se nenhuma migration ja aplicada foi editada.
- Confirme a sincronizacao quadrupla: **ORM entity <-> Migration <-> `docs/database/schema.md` <-> `docs/architecture/compatibility.md`** (quando houver shim ou contract).

### Etapa 2 — Validacao de Logical Database Design
Leia `references/logical-database-checklist.md` e avalie:
- normalizacao (3NF), separacao de agregados e proibicao de colunas derivadas mutaveis sem decisao documentada (ex.: saldo de contas e derivado);
- chaves primarias, chaves estrangeiras explicitas, politica `ON DELETE` coerente com dominio/soft-delete e **indices obrigatorios em colunas de FK** (PostgreSQL nao indexa FKs automaticamente);
- invariantes de linha protegidas no banco via `CHECK` constraints (defesa em profundidade);
- escopo multi-tenant (`user_id`) e soft delete (`WHERE deleted_at IS NULL` / `WHERE is_archived = false`) em indices `UNIQUE`;
- tipos PostgreSQL 16 adequados (`bigint` para centavos, `date` para `DateOnly`, `timestamptz` para `Instant`, `jsonb`, `uuid`).

### Etapa 3 — Rollout N/N+1, Locks e Reversibilidade
Leia `references/sql-queries-and-locks.md` e valide junto com `migration-rollout`:
- compatibilidade com code N apos a migration e com code N+1 antes/depois;
- operacoes bloqueantes em tabelas populadas (`CREATE INDEX` sem `CONCURRENTLY`, `ADD CONSTRAINT` sem `NOT VALID`, `ALTER COLUMN TYPE`, `SET NOT NULL` direto, backfills sem lote);
- ordem de reversao em `down()` (`DROP INDEX` -> `DROP CONSTRAINT` -> `DROP COLUMN`/`TRIGGER` -> `DROP TABLE`) ou justificativa explicita se irreversivel.

### Etapa 4 — Auditoria de Queries SQL / TypeORM na Aplicacao
Leia `references/sql-queries-and-locks.md` e revise `*.repository.ts` e servicos com SQL:
- parametrizacao estrita (zero interpolacao de input externo; `ORDER BY` e filtros dinamicos somente via allowlist);
- propagacao de `options.manager` em toda operacao composta e bypass de cache em `Cached*Repository` durante transacoes;
- locks corretos (`FOR UPDATE`, `SKIP LOCKED`), filtro `user_id` multi-tenant, filtro `deleted_at IS NULL` em queries manuais de `transactions`, prevencao de N+1 e limites de paginacao.

## Saida e Severidade

- Responda em **portugues** (ou siga exatamente o schema JSON solicitado).
- Classifique cada achado em **P0** (corrupcao de dados, SQL injection, quebra de rollback N/N+1, lock severo/downtime, vazamento cross-tenant), **P1** (modelagem logica defeituosa, falta de FK/indice de FK/`CHECK` critico, drift ORM/migration/`schema.md`, bug de transacao/cache) ou **P2** (indice subotimo, convencao inconsistente com impacto manutencional, melhoria documental).
- Para cada achado, cite arquivo/linha, comparacao com o schema/migration existente, cenario concreto de falha e SQL/codigo seguro recomendado.

## References

- `references/logical-database-checklist.md` — Checklist detalhado de modelagem logica PostgreSQL 16 e comparacao historica na Danfy.
- `references/sql-queries-and-locks.md` — Checklist de locks em migrations, reversibilidade (`down()`) e revisao de queries SQL/TypeORM.
