---
area: fiscal-notes
type: flow
status: current
related:
  - ../concepts/fiscal-note-aggregate.md
  - ./preview-and-resilience.md
  - ../decisions/fiscal-notes-core-module-boundary.md
  - ../reference/http-and-error-contracts.md
---

# Import, Link and Lifecycle

Este documento descreve a persistência de `FiscalNote` na etapa de confirmação (`import` ou `link`), a listagem paginada e consultas diretas (`GET /fiscal-notes`, `GET /fiscal-notes/:id`, `GET /transactions/:id/fiscal-note`), o desvínculo independente (`DELETE`) e a sincronização transacional com o ciclo de vida de `Transaction`.

**Regra de ouro de concorrência:** Toda resolução externa via `FiscalNoteQueryService.resolve` (cache Redis ou SEFAZ-CE) ocorre **antes** de abrir qualquer transação PostgreSQL, garantindo que conexões e locks de banco nunca fiquem retidos durante I/O HTTP externo.

## 1. Importação Criando Nova Despesa (`POST /fiscal-notes/import`)

### Pré-condições
- Usuário autenticado, conta (`accountId`) ativa e pertencente ao usuário, categoria (`categoryId`) ativa, pertencente ao usuário e compatível com `EXPENSE`.
- Valor efetivo (`amountCents` override ou `parsed.payableAmountCents`) deve ser inteiro positivo dentro de `TRANSACTION_AMOUNT_CENTS_MAX` (se a nota tiver `payableAmountCents === 0` sem override positivo, falha com `400 INVALID_TRANSACTION` antes de abrir transação no banco).

### Passo a Passo Observável
1. Resolve os dados da nota via `FiscalNoteQueryService.resolve(input, userId)` (cache ou SEFAZ; nunca confia em itens/totais enviados no corpo HTTP).
2. Calcula os valores efetivos da transação com fallback para os dados da nota: `amountCents ?? payableAmountCents`, `date ?? issuedDate`, `description ?? issuerName` (truncado ao limite de descrição), `status ?? EFFECTIVE`.
3. Abre transação curta PostgreSQL (`dataSource.transaction`):
   - Verifica se já existe `FiscalNote` ativa para `(userId, accessKey)`. Se existir, aborta com `409 FISCAL_NOTE_ALREADY_IMPORTED` contendo `details: { existingTransactionId, existingFiscalNoteId }`.
   - Delega ao `TransactionFiscalNotePort.createExpenseWithinTransaction` (que delega ao `CreateTransactionUseCase.execute(..., options)` dentro do mesmo `EntityManager`) o lock de saldo da conta (`AccountBalanceLockPort`), validação de conta/categoria e persistência da `Transaction (EXPENSE)`.
   - Constrói o agregado `FiscalNote` + `FiscalNoteItem[]` + `FiscalNotePayment[]` e persiste na mesma transação.
4. Registra métrica `fiscal_notes.operations.total` (`operation: 'import'`) e retorna `201 Created` (`fiscal_note.import`) com `transaction` (`hasFiscalNote: true`) e `fiscalNote`.

## 2. Vínculo a Despesa Existente (`POST /transactions/:id/fiscal-note`)

### Pré-condições
- A transação alvo pertence ao usuário, não está soft-deletada, é do tipo `EXPENSE` e não possui outra `FiscalNote` ativa vinculada.

### Passo a Passo Observável
1. Resolve os dados da nota via `FiscalNoteQueryService.resolve(input, userId)` fora da transação de banco.
2. Abre transação curta PostgreSQL:
   - Executa `TransactionFiscalNotePort.lockAndValidateExpenseForFiscalNoteLink` com lock pessimista `FOR UPDATE` na linha da `Transaction`. Se inexistente ou de outro usuário -> `404 TRANSACTION_NOT_FOUND`; se `type !== 'EXPENSE'` -> `409 TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE`.
   - Verifica se a transação já possui nota ativa -> `409 TRANSACTION_ALREADY_HAS_FISCAL_NOTE` (`details: { existingFiscalNoteId }`).
   - Verifica se `(userId, accessKey)` já possui nota ativa -> `409 FISCAL_NOTE_ALREADY_IMPORTED` (`details: { existingTransactionId, existingFiscalNoteId }`).
   - Persiste `FiscalNote` + itens + pagamentos **sem alterar nenhum campo** da `Transaction` existente (`amountCents`, `date`, `description`, `accountId`, `categoryId`, `status` permanecem intactos).
3. Registra métrica `operation: 'link'` e retorna `201 Created` (`fiscal_note.item`).

## 3. Listagem Paginada, Consulta Direta e Desvínculo Independente

- **Listagem Paginada (`GET /fiscal-notes`):**
  - Valida e normaliza filtros e paginação (`page >= 1`, `limit` `1..100`), rejeitando faixas inconsistentes (`issuedFrom > issuedTo` ou `minAmountCents > maxAmountCents`) com `400 FISCAL_NOTE_INVALID_INPUT`.
  - Consulta apenas notas ativas (`deleted_at IS NULL`) pertencentes ao usuário autenticado (`userId`), utilizando o índice composto parcial `idx_fiscal_notes_user_issued_at_active` (`(user_id, issued_at DESC) WHERE deleted_at IS NULL`).
  - Converte filtros civis `issuedFrom` e `issuedTo` (`DateOnly`) para limites `timestamptz` no fuso `-03:00` (`[issuedFrom 00:00:00.000-03:00, nextDay(issuedTo) 00:00:00.000-03:00)`) sem envolver `issued_at` em funções SQL, preservando o uso do índice B-Tree.
  - Aplica filtros opcionais combináveis (`AND`): `issuerCnpj` (normalizado para 14 dígitos), `sourceUf` (2 dígitos), `minAmountCents`/`maxAmountCents` sobre `payable_amount_cents` e `search` (até `120` caracteres, trimado e com escape de `\`, `%` e `_`) em `issuer_name` ou `fiscal_note_items.raw_description` via `EXISTS` — evitando multiplicação de linhas na paginação e dupla contagem no `summary`.
  - Ordena exclusivamente por allowlist (`issuedAt`, `payableAmountCents`, `createdAt` em `asc`/`desc`, padrão `issuedAt:desc`) com desempate determinístico por `id`.
  - Retorna `200 OK` (`fiscal_note.list`) com itens leves (`fiscal_note.summary`, expondo `itemsCount` sem carregar arrays `items[]`/`payments[]`), metadados de paginação (`meta`) e totais agregados do recorte filtrado (`summary` / `fiscal_note.summary_totals`).
- **Detalhe Direto (`GET /fiscal-notes/:id`):** Valida `:id` como UUID e busca a `FiscalNote` ativa filtrada por `(id, userId)` via `findActiveByIdAndUserId` (isolamento multi-tenant anti-IDOR). Se não existir, estiver soft-deletada ou pertencer a outro usuário, retorna `404 FISCAL_NOTE_NOT_FOUND`. Em caso positivo, retorna `200 OK` (`fiscal_note.item`) com `items` e `payments` ordenados por `position ASC`.
- **Consulta por Transação (`GET /transactions/:id/fiscal-note`):** Valida acessibilidade da transação (`404 TRANSACTION_NOT_FOUND`) e busca a `FiscalNote` ativa com itens e pagamentos ordenados por `position ASC`. Se não houver nota ativa vinculada, retorna `404 FISCAL_NOTE_NOT_FOUND`.
- **Desvínculo (`DELETE /transactions/:id/fiscal-note`):** Dentro de uma transação PostgreSQL, valida acessibilidade da transação e executa soft delete (`deleted_at = now()`) apenas na `FiscalNote` ativa (`404 FISCAL_NOTE_NOT_FOUND` se inexistente). A `Transaction` permanece intacta, liberando tanto a transação para receber outra nota quanto a `accessKey` para reimportação pelo mesmo usuário (`204 No Content`).

## 4. Integração com o Ciclo de Vida de `transactions`

- **Indicador `hasFiscalNote` sem N+1:** `ListTransactionsUseCase` consulta `FiscalNoteTransactionLifecyclePort.findActiveTransactionIds(transactionIds)` em uma única query em lote (`IN (...) AND deleted_at IS NULL`). `GetTransactionUseCase`, `UpdateTransactionUseCase`, `ConfirmTransactionUseCase` e `CreateExpenseWithinTransaction` mantêm `hasFiscalNote` coerente em respostas individuais.
- **Bloqueio de Mudança de Tipo:** `UpdateTransactionUseCase` e `ConfirmTransactionUseCase` consultam `hasActiveByTransactionId` dentro da transação (já sob lock `FOR UPDATE` da `Transaction`); se houver nota ativa e o patch tentar alterar `type` para algo diferente de `EXPENSE`, bloqueiam com `409 TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE`.
- **Soft Delete Sincronizado:** `DeleteTransactionUseCase` executa `fiscalNoteLifecyclePort.softDeleteByTransactionId(transactionId, userId, { manager })` **dentro da mesma transação PostgreSQL** do soft delete da transação. Isso garante atomicidade imediata: a transação deletada não deixa nota ativa órfã nem bloqueia futura reimportação daquela `accessKey`.

## Idempotência e Concorrência (`23505` -> `409`)

Requisições simultâneas tentando importar a mesma `accessKey` pelo mesmo usuário ou vincular duas notas à mesma transação podem passar pelas checagens iniciais antes do commit. O banco garante a invariante através dos índices parciais únicos `UQ_fiscal_notes_user_access_key_active` e `UQ_fiscal_notes_transaction_active`.

Ao capturar `QueryFailedError` com código PostgreSQL `23505` (`PG_UNIQUE_VIOLATION_CODE`), `handleFiscalNoteUniqueConstraintError` inspeciona `driverError.constraint`, consulta o registro ativo conflitante e converte a falha determinística no erro `409` correspondente com `details` preenchido.

## Tratamento de Falhas e Casos de Borda

| Cenário | Comportamento do Sistema | Estado Resultante |
| --- | --- | --- |
| Falha na criação da despesa no `import` | Transação PostgreSQL sofre rollback completo | Nem `Transaction` nem `FiscalNote` são criados |
| Race condition `23505` em `UQ_fiscal_notes_user_access_key_active` | Rollback da transação + busca registro ativo -> `409 FISCAL_NOTE_ALREADY_IMPORTED` | Nenhuma duplicata persistida; retorna IDs conflitantes |
| Race condition `23505` em `UQ_fiscal_notes_transaction_active` | Rollback da transação + busca nota ativa -> `409 TRANSACTION_ALREADY_HAS_FISCAL_NOTE` | Transação mantém apenas a nota vencedora |
| Transação de outro usuário ou soft-deletada | `TransactionFiscalNotePort` lança `404 TRANSACTION_NOT_FOUND` | Isolamento multi-tenant preservado |
| Troca de `type` para `INCOME`/`TRANSFER` com nota ativa | Bloqueia com `409 TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE` | Usuário deve desvincular a nota antes de mudar o tipo |
