---
area: database
type: guide
status: current
last_reviewed: 2026-11-24
related:
  - ./README.md
  - ./schema.md
  - ./migration-rollout.md
  - ../architecture/compatibility.md
  - ../architecture/module-boundaries.md
  - ../platform/dates-and-times.md
---

# Diretrizes de Revisão de SQL, Migrations e Modelagem Lógica

Este documento define o padrão técnico para avaliar alterações em SQL, migrations TypeORM (`api/src/database/migrations/`), ORM entities (`*-orm.entity.ts`), scripts em `sql/` e consultas SQL/TypeORM em repositórios.

Ele complementa [Rollout de Migrations](./migration-rollout.md): enquanto `migration-rollout.md` governa **compatibilidade de deploy e rollback (`expand -> migrate -> contract`)**, este guia governa **coerência com o schema existente, modelagem lógica de banco (PostgreSQL 16) e segurança/performance de queries**.

---

## 1. Alinhamento com o Schema e Migrations Históricas

Antes de aprovar ou escrever qualquer SQL, compare o diff com [Schema do Banco](./schema.md) e com as migrations mais recentes do mesmo módulo em `api/src/database/migrations/`.

Verificações obrigatórias:

- **Reuso de objetos existentes:**
  - reutilizar a função `set_updated_at()` já criada na migration inicial para triggers `BEFORE UPDATE` (`trg_<table>_updated_at`); nunca criar uma função duplicada;
  - reutilizar `gen_random_uuid()` (`pgcrypto`) para PKs `uuid`;
  - verificar enums e tipos já existentes antes de criar novos; preferir `varchar` + `CHECK` constraint quando o conjunto de valores puder evoluir com `expand -> migrate -> contract` sem os custos operacionais de `ALTER TYPE ... ENUM`.
- **Convenções de nomenclatura do projeto:**
  - tabelas e colunas em `snake_case`;
  - Primary Keys: `PK_<table>`;
  - Foreign Keys: `FK_<table>_<ref>`;
  - Unique constraints/indexes: `UQ_<table>_<campo_ou_regra>`;
  - Check constraints: `CHK_<table>_<regra>`;
  - Índices não-únicos: `idx_<table>_<colunas_ou_proposito>`;
  - Triggers de `updated_at`: `trg_<table>_updated_at`.
- **Imutabilidade do histórico:** migrations já aplicadas nunca podem ser editadas; ajustes exigem nova migration incremental.
- **Sincronização quádrupla:** toda alteração de schema deve manter alinhados:
  1. ORM entity (`*-orm.entity.ts`);
  2. Migration em `api/src/database/migrations/`;
  3. `docs/database/schema.md`;
  4. `docs/architecture/compatibility.md` (quando houver shim temporário, dual-read, dual-write ou contract adiado).

---

## 2. Validação de Logical Database Design

Toda nova tabela, coluna, relacionamento ou constraint deve passar por revisão de modelagem lógica:

### 2.1. Normalização e Fronteira de Agregados
- Aplicar **3NF por padrão**: cada tabela representa uma única entidade ou evento de domínio bem definido.
- **Sem dados derivados mutáveis sem decisão registrada:** não persistir saldos, contadores ou projeções mutáveis junto da tabela operacional sem decisão arquitetural documentada (ex.: o saldo de `accounts` é derivado de `transactions` e não possui coluna mutável).
- **Separação de agregados:** tabelas de catálogos, templates, metadados de arquivo (`assets`) e tabelas operacionais (`outbox_messages`, `email_messages`) permanecem desacopladas dos agregados consumidores via referência lógica.

### 2.2. Chaves, Relacionamentos e Integridade Referencial
- Toda tabela possui Primary Key explícita (`uuid` com `DEFAULT gen_random_uuid()` salvo justificativa explícita).
- Todo relacionamento possui `FOREIGN KEY` explícita com política `ON DELETE` deliberada e coerente com o domínio:
  - evitar `ON DELETE CASCADE` em dados financeiros/auditáveis onde exclusão silenciosa corromperia histórico ou referências;
  - considerar `ON DELETE RESTRICT` / `NO ACTION` (inclusive `DEFERRABLE INITIALLY DEFERRED` quando necessário) ou `ON DELETE SET NULL` conforme a regra de ciclo de vida;
  - quando a entidade pai usa soft delete (`deleted_at`), `ON DELETE` físico não dispara — validar se a aplicação/banco mantém a invariante lógica.
- **Índices em Foreign Keys:** o PostgreSQL **não cria índices automaticamente em colunas de FK**. Toda coluna de FK usada em joins, exclusões do pai ou filtros precisa de índice dedicado (ou ser prefixo de um índice composto coerente).

### 2.3. Invariantes no Banco (Defense in Depth)
- Regras estruturais da linha (valores positivos como `amount_cents > 0`, domínios fechados de status/tipo, exclusividade mútua entre colunas por tipo, formatos críticos como ISPB/storage key, proibição de soft delete em `TRANSFER`) devem ser protegidas por `CHECK` constraints no PostgreSQL, além da validação no domínio.
- **Multi-tenancy e Soft Delete em índices `UNIQUE`:**
  - conferir se a unicidade é global ou por `user_id` (ex.: `UNIQUE (user_id, ...)` vs global);
  - em tabelas com `deleted_at` ou arquivamento, verificar se a unicidade deve ser **parcial** (`WHERE deleted_at IS NULL`, `WHERE is_archived = false`, `WHERE template_type = 'INSTITUTIONAL'`).
- **Limitação explícita de FKs cross-tenant:** uma FK simples (`account_id -> accounts(id)`) não impede vínculo entre registros de usuários diferentes; verificar se a aplicação reforça o ownership ou se uma FK composta `(user_id, ref_id)` faz sentido no modelo.

### 2.4. Tipos PostgreSQL 16
- **Dinheiro:** exclusivamente inteiros em centavos (`bigint` para valores monetários como `amount_cents` e `initial_balance_cents`). Nunca `float`, `real`, `double precision` ou `money`.
- **Datas e Instantes:**
  - `DateOnly` (data civil `YYYY-MM-DD`) → `date`;
  - `Instant` (ponto exato no tempo em UTC) → `TIMESTAMP WITH TIME ZONE` (`timestamptz`), nunca `timestamp` sem timezone.
- **JSON e Texto:** usar `jsonb` em vez de `json`; alinhar tamanhos `character varying(N)` às constantes de `@/common/models/constants`.
- **Booleanos e defaults:** colunas booleanas de flag devem ser `NOT NULL` com default explícito sempre que semanticamente binárias.

### 2.5. Estratégia de Índices
- Escolher o tipo e a ordem das colunas de acordo com os predicados reais de leitura (ex.: `(user_id, date)` ou `(user_id, status)` para consultas multi-tenant).
- Usar índices parciais para filas, reconciliação e estados transitórios (ex.: `WHERE status IN ('PENDING_UPLOAD', 'DELETE_PENDING', 'FAILED')` ou `WHERE consumed_at IS NULL`), evitando indexar linhas históricas frias.
- Evitar índices redundantes cujo prefixo já é coberto por outro índice composto.

---

## 3. Rollout, Locks e Segurança Operacional de Migrations

Aplicar junto com [Rollout de Migrations](./migration-rollout.md):

- **Compatibilidade N/N+1:** toda alteração incompatível (`DROP`, `RENAME`, `NOT NULL`, troca de tipo/formato, endurecimento de `CHECK`/enum) exige separação em `expand -> migrate -> contract` e registro em `docs/architecture/compatibility.md`.
- **Locks no PostgreSQL:**
  - atenção especial a operações que adquirem `ACCESS EXCLUSIVE` em tabelas existentes e populadas (`CREATE INDEX` sem `CONCURRENTLY`, `ALTER TABLE ... ADD CONSTRAINT` sem `NOT VALID`, `ALTER COLUMN TYPE` com reescrita de tabela, `SET NOT NULL` sem `CHECK NOT VALID` prévio);
  - avaliar `lock_timeout` e impacto de fila de locks quando a migration altera tabelas quentes;
  - backfills grandes devem rodar em lotes curtos (`LIMIT` / `FOR UPDATE SKIP LOCKED`) fora de transações longas.
- **Reversibilidade (`down()`):** conferir se `down()` desfaz objetos na ordem inversa de dependência (`DROP INDEX` → `DROP CONSTRAINT` → `DROP COLUMN` / `DROP TRIGGER` → `DROP TABLE`), ou documenta explicitamente quando a migration de dados não é reversível.

---

## 4. Revisão de Queries SQL e TypeORM na Aplicação

Para mudanças em repositórios (`*.repository.ts`) e serviços que executam SQL:

- **Parametrização obrigatória:** zero concatenação/interpolação de input externo em `queryRunner.query()`, `manager.query()`, `.where()`, `.andWhere()` ou `.orderBy()`. Ordenação e filtros dinâmicos devem passar por allowlist explícita.
- **Contexto transacional:** operações multi-escrita ou read-modify-write devem propagar `options.manager` para **todos** os repositórios participantes e aplicar lock adequado (`FOR UPDATE`, `SKIP LOCKED`) dentro da mesma transação.
- **Cache vs Transação:** repositórios cacheados devem contornar o cache quando `options?.manager` está presente (leitura transacional consistente) e invalidar imediatamente após mutação bem-sucedida.
- **Eficiência e segurança de leitura:** verificar queries N+1 em loops, ausência de filtros `deleted_at IS NULL` em queries manuais na tabela `transactions`, ausência de filtro `user_id` em tabelas multi-tenant e ausência de limite superior em listagens.
