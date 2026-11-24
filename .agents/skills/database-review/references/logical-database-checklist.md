# Checklist de Modelagem Logica PostgreSQL e Comparacao Historica (Danfy)

Use esta referencia ao revisar migrations, ORM entities e scripts em `sql/`.

---

## 1. Comparacao com `docs/database/schema.md` e Migrations Existentes

- [ ] **Reuso de `set_updated_at()`:** toda tabela com `updated_at` cria trigger `trg_<table>_updated_at` chamando `EXECUTE FUNCTION "set_updated_at"()` (nunca recria a funcao).
- [ ] **Reuso de `pgcrypto`:** PKs `uuid` usam `DEFAULT gen_random_uuid()` (sem instalar extensoes redundantes como `uuid-ossp`).
- [ ] **Convencoes de nomes:**
  - tabela e colunas em `snake_case`;
  - `PK_<table>`, `FK_<table>_<ref>`, `UQ_<table>_<regra>`, `CHK_<table>_<regra>`, `idx_<table>_<colunas>`, `trg_<table>_updated_at`.
- [ ] **Alinhamento ORM <-> Migration:** tipos, comprimentos `varchar(N)`, nullability, defaults, nomes de colunas e constraints na `*OrmEntity` batem exatamente com o SQL da migration.
- [ ] **Alinhamento com `docs/database/schema.md`:** nova tabela aparece tanto na tabela de `Visao Geral` quanto em secao propria (Colunas, Constraints, Indices, Relacionamentos, Triggers) e em `Objetos Auxiliares` (lista de triggers de `set_updated_at()`, enums, etc.).
- [ ] **Historico intacto:** nenhuma migration anterior foi alterada.

---

## 2. Normalizacao e Fronteira Logica (3NF)

- [ ] **Entidade unica por tabela:** cada tabela modela um conceito claro de negocio ou tabela operacional (`outbox_messages`, `email_messages`, `password_change_events`), sem misturar agregados distintos.
- [ ] **Sem atributos derivados mutaveis sem decisao:** nao armazena totais, saldos ou contadores que possam divergir dos fatos (ex.: saldo de conta e derivado das `transactions`).
- [ ] **Sem listas separadas por virgula ou arrays sem justificativa:** relacionamentos 1:N e N:N usam tabelas/FKs proprias; `jsonb` so para payloads semi-estruturados bem delimitados (ex.: metadata/outbox payload) e nunca para mascarar chaves relacionais essenciais.
- [ ] **Tabela operacional vs recurso de usuario:** se a tabela for operacional (como `email_messages` ou `outbox_messages`), confirmar que nao e exposta como recurso multi-tenant sem `user_id` explicito; se for recurso de usuario, possui `user_id NOT NULL` com FK para `users(id)`.

---

## 3. Chaves, Relacionamentos e Integridade Referencial

- [ ] **PK explicita:** toda tabela possui `PRIMARY KEY` nomeada (`PK_<table>`).
- [ ] **FKs explicitas:** toda coluna `*_id` que referencia outra tabela declara `FOREIGN KEY` explicita.
- [ ] **Politica `ON DELETE` segura:**
  - `CASCADE` somente quando a exclusao do pai deve eliminar filhos sem violar auditoria/historico financeiro (ex.: tokens/challenges/templates privados de um usuario excluido);
  - `RESTRICT` ou `NO ACTION` para proteger entidades com movimentacao financeira ou vinculos ativos;
  - `SET NULL` apenas quando a coluna e nullable e a orfandade e estado valido de negocio (ex.: `users.avatar_asset_id`).
- [ ] **Indice em toda coluna de FK:** o PostgreSQL nao indexa FKs automaticamente. Verifique se cada FK possui `CREATE INDEX` (ou e prefixo de um indice composto) para evitar sequential scans em joins e em `DELETE` da tabela pai.
- [ ] **Integridade cross-tenant:** lembre que FK simples (`account_id -> accounts(id)`) nao impede que uma linha de `user A` aponte para um recurso de `user B`. Confirme se a aplicacao valida ownership na mesma transacao ou se o modelo requer FK composta.

---

## 4. Constraints `CHECK` e Indices `UNIQUE`

- [ ] **Defesa em profundidade com `CHECK`:**
  - valores monetarios/quantidades positivos (`amount_cents > 0`, `credential_version > 0`);
  - dominios fechados (`template_type IN (...)`, `status IN (...)`, `direction IN (...)`);
  - exclusividade mutua condicional entre colunas (ex.: `type = 'ADJUSTMENT'` exige `direction IS NOT NULL`; `template_type = 'INSTITUTIONAL'` exige `owner_user_id IS NULL` e metadados institucionais);
  - formatos criticos (ex.: `storage_key` nao vazio e sem prefixo `/`, ISPB com 8 digitos);
  - regras de soft delete (ex.: `CHK_transactions_transfer_not_deleted`).
- [ ] **Escopo correto de `UNIQUE`:**
  - verificar se deve ser por usuario (`(user_id, nome)`) em vez de global;
  - em tabelas com soft delete (`deleted_at`) ou arquivamento (`is_archived`), verificar se precisa ser **indice unico parcial** (`WHERE deleted_at IS NULL`, `WHERE is_archived = false`) para nao impedir recriacao valida apos exclusao.

---

## 5. Tipos de Dados PostgreSQL 16

- [ ] **Dinheiro:** `bigint` em centavos (`*_cents`). Nunca `float`, `real`, `double precision`, `numeric` misturado com `number` JS ou `money`.
- [ ] **Datas:** `date` para `DateOnly` (`YYYY-MM-DD`); `TIMESTAMP WITH TIME ZONE` (`timestamptz`) para `Instant`. Nunca `TIMESTAMP WITHOUT TIME ZONE`.
- [ ] **Texto e limites:** `character varying(N)` alinhado as constantes de `@/common/models/constants`, ou `text` quando ilimitado intencionalmente (ex.: payloads/observacoes).
- [ ] **JSON:** `jsonb` em vez de `json`.
- [ ] **Enums vs `varchar + CHECK`:** avaliar se criar `CREATE TYPE ... AS ENUM` dificultara evolucoes futuras (`DROP VALUE` nao existe em Postgres) em comparacao com `varchar + CHECK`.
- [ ] **Flags booleanas:** `boolean NOT NULL DEFAULT ...` (evitar booleano tri-estado `NULL` sem semantica clara).
