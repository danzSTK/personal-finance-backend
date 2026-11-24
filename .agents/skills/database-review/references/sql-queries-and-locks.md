# Checklist de Locks em Migrations e Revisao de Queries SQL/TypeORM

Use esta referencia ao revisar migrations em tabelas existentes e queries SQL/TypeORM em repositorios e servicos.

---

## 1. Riscos de Lock e Execucao em Producao (PostgreSQL 16)

Mesmo que uma migration passe em um banco vazio no CI, ela pode causar indisponibilidade em producao se adquirir locks bloqueantes em tabelas populadas:

| Operacao SQL | Risco em tabela populada | Caminho seguro |
| --- | --- | --- |
| `CREATE INDEX` / `CREATE UNIQUE INDEX` | Adquire `SHARE` lock (bloqueia `INSERT`/`UPDATE`/`DELETE` durante toda a construcao) | Usar `CREATE INDEX CONCURRENTLY` em tabelas ja populadas (fora de transacao: `transaction = false` na migration TypeORM) ou justificar se a tabela e nova/vazia. |
| `ALTER TABLE ... ADD CONSTRAINT ... CHECK / FOREIGN KEY` | Valida a tabela inteira sob lock que bloqueia escritas | Em tabelas populadas, usar `ADD CONSTRAINT ... NOT VALID` seguido de `ALTER TABLE ... VALIDATE CONSTRAINT ...` (adquire `SHARE UPDATE EXCLUSIVE`, nao bloqueia DML). |
| `ALTER TABLE ... ALTER COLUMN ... SET NOT NULL` | Varre a tabela inteira sob `ACCESS EXCLUSIVE` se nao houver `CHECK (col IS NOT NULL)` valido | Em tabelas populadas, adicionar `CHECK (col IS NOT NULL) NOT VALID`, executar `VALIDATE CONSTRAINT` e so depois `SET NOT NULL` (Postgres usa o check valido para pular o full scan). |
| `ALTER TABLE ... ALTER COLUMN ... TYPE ...` | Frequentemente reescreve a tabela inteira sob `ACCESS EXCLUSIVE` e quebra compatibilidade N/N+1 | Aplicar `expand -> migrate -> contract` com nova coluna paralela e backfill em lotes. |
| `UPDATE tabela SET ...` sem `LIMIT` (backfill monolitico) | Segura locks de linha por longo tempo, infla dead tuples (bloat) e trava autovacuum/replicacao | Executar backfill em lotes curtos (ex.: comando/job repetivel com `LIMIT` + `FOR UPDATE SKIP LOCKED`, como `account-templates:reconcile`). |
| `ALTER TABLE` em tabela quente sem `lock_timeout` | Pode ficar aguardando uma query longa e formar fila de `ACCESS EXCLUSIVE` bloqueando todo o trafego novo | Avaliar uso de `SET LOCAL lock_timeout` em migrations que alteram tabelas quentes de producao. |

### Reversibilidade (`down()`)
- Conferir se `down()` remove objetos na ordem inversa de dependencia:
  1. `DROP INDEX IF EXISTS ...`
  2. `ALTER TABLE ... DROP CONSTRAINT IF EXISTS ...`
  3. `ALTER TABLE ... DROP COLUMN IF EXISTS ...`
  4. `DROP TRIGGER IF EXISTS ... ON ...`
  5. `DROP TABLE IF EXISTS ...`
  6. `DROP TYPE IF EXISTS ...` (somente se criado pela propria migration)
- Nunca dropar `set_updated_at()` em `down()` de migrations incrementais (ela e compartilhada por todas as tabelas).

---

## 2. Revisao de Queries SQL e TypeORM na Aplicacao

Ao revisar `*.repository.ts`, `*.service.ts`, comandos em `api/src/commands/` e scripts em `sql/`:

### Seguranca (SQL Injection)
- [ ] **Parametrizacao total:** todos os valores dinamicos passam via parametros ligados (`$1`, `$2` ou `:paramName` no QueryBuilder). Zero template string `${userInput}` em SQL.
- [ ] **Identificadores dinamicos (`ORDER BY`, colunas, direcao `ASC`/`DESC`):** jamais passar input do cliente diretamente para `.orderBy()` ou SQL bruto; mapear por allowlist/switch fechado.

### Consistencia Transacional e Concorrencia
- [ ] **Propagacao de `EntityManager`:** metodos chamados dentro de `dataSource.transaction(manager => ...)` recebem e usam `options.manager` (nunca `this.repository` default fora da transacao).
- [ ] **Cache dentro de transacao:** `Cached*Repository` deve contornar o cache quando `options?.manager` estiver definido para nao ler dados obsoletos ou vazar estado nao commitado.
- [ ] **Locks explicitos:** operacoes sensiveis a corrida (read-modify-write, claim de fila/outbox, reconciliacao em lote, limite de tentativas) usam `FOR UPDATE` ou `FOR UPDATE SKIP LOCKED` dentro da transacao, ou constraint `UNIQUE` com tratamento deterministico do codigo de erro Postgres (`23505`).

### Corretude de Dominio e Performance
- [ ] **Isolamento multi-tenant:** queries em tabelas de usuario filtram explicitamente por `user_id = :userId`.
- [ ] **Soft delete em `transactions`:** queries manuais (QueryBuilder ou SQL raw) sobre `transactions` filtram `deleted_at IS NULL` (exceto quando o caso de uso pedir explicitamente historico deletado).
- [ ] **Arquivamento:** listagens padrao de `accounts` e `categories` respeitam `is_archived = false` salvo quando explicitamente solicitado.
- [ ] **N+1 e varredura sem limite:** sinalizar consultas dentro de loops `for`/`Promise.all` (preferir `IN (...)` ou join) e listagens sem paginacao ou limite superior.
- [ ] **Alinhamento com indices:** conferir se o `WHERE` e o `ORDER BY` da nova query conseguem usar um indice existente ou criado na mesma PR (evitando full table scan em tabelas que crescem continuamente, como `transactions`, `outbox_messages`, `email_messages` e `password_change_events`).
