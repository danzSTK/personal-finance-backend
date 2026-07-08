---
area: accounts
feature: account-summary
type: spec-design
status: current
related:
  - ./requirements.md
  - ./decisions.md
  - ../../../../accounts/concepts/account-balance.md
  - ../../../../transactions/reference/schema.md
  - ../../../../database/schema.md
---

# Design - Account Summary

## Arquitetura

Esta feature pertence ao `AccountsModule`.

Saldo atual e saldo projetado são leituras de estado financeiro de accounts. O módulo de transactions continua responsável por listar movimentações e calcular deltas baseados em filtros de transactions.

Fluxo novo:

```text
AccountsController.summary
  -> GetAccountSummaryUseCase.execute
    -> IAccountBalanceRepository.getUserSummary
      -> AccountBalanceRepository
```

Fluxo alterado:

```text
TransactionsController.list
  -> ListTransactionsUseCase.execute
    -> ITransactionRepository.list
      -> TransactionRepository.getGroupedSummary
```

O fluxo de transactions deixa de chamar cálculo de saldo atual.

## Camadas Afetadas

### Accounts

Adicionar:

```text
api/src/modules/accounts/
├── application/use-cases/get-account-summary/
│   ├── get-account-summary.dto.ts
│   └── get-account-summary.use-case.ts
└── presentation/dto/
    ├── get-account-summary.query.dto.ts
    └── account-summary.response.dto.ts
```

Atualizar:

```text
api/src/modules/accounts/domain/repositories/account-balance.repository.interface.ts
api/src/modules/accounts/infrastructure/persistence/account-balance.repository.ts
api/src/modules/accounts/presentation/http/accounts.controller.ts
api/src/modules/accounts/accounts.module.ts
```

### Transactions

Atualizar:

```text
api/src/modules/transactions/domain/repositories/transaction.repository.interface.ts
api/src/modules/transactions/application/use-cases/list-transactions/list-transactions.dto.ts
api/src/modules/transactions/infrastructure/persistence/transaction.repository.ts
api/src/modules/transactions/presentation/dto/list-transactions.response.dto.ts
```

Remover de transactions:

- `currentBalanceCents` do tipo grouped summary;
- `getCurrentBalanceCents`;
- chamada a `getCurrentBalanceCents` dentro de `getGroupedSummary`.

## Contratos Internos

Adicionar no repository de saldo:

```ts
export interface AccountSummary {
  currentCents: number;
  projectedCents?: number;
  projectedUntil?: DateOnlyString;
}

export interface GetAccountSummaryInput {
  userId: string;
  includeArchived?: boolean;
  includeExcludedFromTotal?: boolean;
  projectedUntil?: DateOnlyString;
}
```

Adicionar método:

```ts
abstract getUserSummary(input: GetAccountSummaryInput): Promise<AccountSummary>;
```

O método existente `getSummaries` continua atendendo `GET /accounts` por account.

## API

Endpoint novo:

```http
GET /accounts/summary
GET /accounts/summary?projectedUntil=2026-06-30
GET /accounts/summary?includeArchived=true
GET /accounts/summary?includeExcludedFromTotal=true
GET /accounts/summary?includeArchived=true&includeExcludedFromTotal=true&projectedUntil=2026-06-30
```

Query params:

| Campo | Tipo | Default | Observação |
|---|---|---|---|
| `projectedUntil` | `YYYY-MM-DD` | - | Quando enviado, retorna `projectedCents` até esta data |
| `includeArchived` | `boolean` | `false` | Quando `true`, inclui accounts arquivadas |
| `includeExcludedFromTotal` | `boolean` | `false` | Quando `true`, inclui accounts com `includeInTotal=false` |

Response:

```json
{
  "object": "account.summary",
  "currentCents": 250000,
  "projectedCents": 210000,
  "projectedUntil": "2026-06-30"
}
```

## Query Strategy

O cálculo deve continuar set-based, usando CTEs e agregação no PostgreSQL.

A query deve separar claramente:

1. `target_accounts`: define o conjunto de accounts selecionadas pelos filtros;
2. `movement_deltas`: calcula impactos por account selecionada;
3. `aggregated_deltas`: agrega origem e destino;
4. select final: soma `initial_balance_cents + delta` para retornar um único total.

Filtro base de `target_accounts`:

```sql
WHERE account."user_id" = $1
  AND ($2::boolean = true OR account."is_archived" = false)
  AND ($3::boolean = true OR account."include_in_total" = true)
```

O saldo atual deve considerar somente:

```sql
tx."status" = 'EFFECTIVE'
tx."deleted_at" IS NULL
```

O saldo projetado deve considerar:

```sql
tx."status" IN ('EFFECTIVE', 'PENDING')
tx."deleted_at" IS NULL
tx."date" <= projectedUntil
```

### Transferências E Filtros De Accounts

Transferências devem ser calculadas pela perspectiva das accounts em `target_accounts`.

Se origem e destino estiverem em `target_accounts`, o impacto líquido no agregado é zero.

Se somente a origem estiver em `target_accounts`, o agregado diminui.

Se somente o destino estiver em `target_accounts`, o agregado aumenta.

Isso preserva a regra: a fórmula de saldo é a mesma; os query params apenas mudam quais accounts participam da soma.

## Índices E Performance

Não há mudança de schema prevista.

A query deve reutilizar índices existentes documentados em `docs/database/schema.md`:

- `idx_accounts_user_id`;
- `idx_accounts_user_not_archived`;
- `idx_transactions_account_effective`;
- `idx_transactions_destination_account_effective`.

Observação: projeção com transactions `PENDING` pode não aproveitar totalmente os índices parciais de efetivas. Não criar índice nesta spec sem evidência de lentidão. Se `EXPLAIN (ANALYZE, BUFFERS)` em massa real apontar gargalo, abrir spec específica de índice.

## DTOs De Apresentação

Criar `GetAccountSummaryQueryDto` com:

- `projectedUntil?: DateOnlyString` validado como date-only;
- `includeArchived?: boolean` com transformação explícita de strings `true`/`false`;
- `includeExcludedFromTotal?: boolean` com transformação explícita de strings `true`/`false`.

Não usar `@Type(() => Boolean)` para estes campos, nem em `GetAccountSummaryQueryDto` nem em `ListAccountsQueryDto`, porque `Boolean('false')` resulta em `true`.

Criar `AccountSummaryResponseDto`:

```ts
{
  object: typeof RESPONSE_OBJECT_TYPES.ACCOUNT_SUMMARY;
  currentCents: number;
  projectedCents?: number;
  projectedUntil?: string;
}
```

Adicionar `ACCOUNT_SUMMARY = 'account.summary'` nos constants de response object, se ainda não existir.

## Errors

Não há novo erro de domínio ou aplicação previsto.

Erros esperados:

- `VALIDATION_ERROR` para `projectedUntil` inválido;
- `VALIDATION_ERROR` para boolean query inválida, conforme pipe/DTO global;
- `UNAUTHORIZED` para sessão ausente ou inválida.

Controllers não devem traduzir erros manualmente.

## Segurança

- `userId` vem de `@CurrentUser()`.
- O cliente não envia `userId`.
- A query filtra accounts por `account.user_id`.
- A query filtra transactions por `tx.user_id`.
- Accounts e transactions de outro usuário não entram no cálculo mesmo que existam UUIDs relacionados no banco.

## Impacto Em Transactions

O tipo grouped summary deve mudar de:

```ts
{
  currentBalanceCents: number;
  income: TransactionTypeSummary;
  expense: TransactionTypeSummary;
  balance: TransactionBalanceSummary;
}
```

para:

```ts
{
  income: TransactionTypeSummary;
  expense: TransactionTypeSummary;
  balance: TransactionBalanceSummary;
}
```

`getGroupedSummary` continua calculando:

- `income.pendingCents`;
- `income.effectiveCents`;
- `expense.pendingCents`;
- `expense.effectiveCents`;
- `pendingDeltaCents`;
- `effectiveDeltaCents`;
- `expectedBalanceCents`.

`TransactionRepository` não deve consultar `accounts` para responder saldo atual.

## Testes

### Accounts

Criar testes para `GetAccountSummaryUseCase`:

- repassa filtros ao repository;
- retorna summary com projeção;
- retorna summary sem projeção.

Criar testes de repository ou integração de infraestrutura para:

- saldo atual sem transactions;
- income effective;
- expense effective;
- transfer origem/destino;
- adjustment increase/decrease;
- pending ignorada no current;
- pending considerada no projected até data;
- deleted ignorada;
- `includeArchived=false` exclui arquivadas;
- `includeArchived=true` inclui arquivadas;
- `includeExcludedFromTotal=false` exclui `includeInTotal=false`;
- `includeExcludedFromTotal=true` inclui `includeInTotal=false`;
- ambos os filtros combinados;
- nenhuma account selecionada retorna zero.

### Transactions

Atualizar testes para:

- grouped summary sem `currentBalanceCents`;
- response DTO sem `currentBalanceCents`;
- repository não chama mais cálculo de saldo atual;
- docs/snapshots, se existirem, alinhados ao contrato.

## Documentação

Atualizar:

- `docs/integrations/accounts/README.md`;
- `docs/integrations/accounts/list-accounts.md`, se necessário referenciar o novo endpoint;
- criar `docs/integrations/accounts/get-account-summary.md`;
- `docs/integrations/transactions/list-transactions.md`;
- `docs/specs/transactions/list-filters-summary/specs/requirements.md`;
- `docs/specs/transactions/list-filters-summary/specs/design.md`;
- `docs/specs/transactions/list-filters-summary/specs/decisions.md`;
- Swagger de accounts e transactions.

## Migrations

Não há migration prevista.

Se a implementação exigir novo índice, a spec deve ser atualizada antes da criação da migration e `docs/database/schema.md` deve ser revisado.
