---
area: transactions
feature: list-filters-summary
type: spec-design
status: approved
related:
  - ./requirements.md
  - ./decisions.md
  - ../../../../transactions/reference/schema.md
  - ../../../../integrations/transactions/list-transactions.md
---

# Design - Transaction List Filters And Summary

## Arquitetura

A mudança fica dentro do `TransactionsModule`, porque o endpoint, os filtros, a query de leitura e o response pertencem à listagem de transactions.

Fluxo esperado:

```text
TransactionsController.list
  -> ListTransactionsUseCase.execute
    -> ITransactionRepository.list
      -> TransactionRepository
```

O use case continua responsável por normalizar defaults de paginação e por montar `meta`.

O repository fica responsável por aplicar filtros, sort e agregação, porque esses comportamentos dependem da query TypeORM/SQL.

## Estado Atual Do Código

Arquivos envolvidos:

- `api/src/modules/transactions/presentation/http/transactions.controller.ts`;
- `api/src/modules/transactions/presentation/dto/list-transactions.query.dto.ts`;
- `api/src/modules/transactions/presentation/dto/list-transactions.response.dto.ts`;
- `api/src/modules/transactions/application/use-cases/list-transactions/list-transactions.dto.ts`;
- `api/src/modules/transactions/application/use-cases/list-transactions/list-transactions.use-case.ts`;
- `api/src/modules/transactions/domain/repositories/transaction.repository.interface.ts`;
- `api/src/modules/transactions/infrastructure/persistence/transaction.repository.ts`.

Hoje os filtros principais já existem no DTO/controller/use case/repository.

Mudanças principais:

- adicionar `sort`;
- adicionar summary simples quando `type` for enviado;
- adicionar summary agrupado quando `type` não for enviado;
- restringir a listagem sem `type` para `INCOME` e `EXPENSE`;
- adicionar cálculo agregado no repository.

## Contrato HTTP

Endpoint mantido:

```http
GET /transactions
```

Query final da feature:

```text
dateFrom?: YYYY-MM-DD
dateTo?: YYYY-MM-DD
type?: INCOME | EXPENSE | TRANSFER | ADJUSTMENT
status?: PENDING | EFFECTIVE
accountId?: uuid
categoryId?: uuid
page?: number
limit?: number
sort?: date:desc | date:asc
```

Response:

Com `type` explícito:

```json
{
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "summary": {
    "pendingCents": 0,
    "effectiveCents": 0,
    "totalCents": 0
  }
}
```

Sem `type`:

```json
{
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "summary": {
    "currentBalanceCents": 250000,
    "income": {
      "pendingCents": 120000,
      "effectiveCents": 300000,
      "totalCents": 420000
    },
    "expense": {
      "pendingCents": 80000,
      "effectiveCents": 150000,
      "totalCents": 230000
    },
    "balance": {
      "pendingDeltaCents": 40000,
      "effectiveDeltaCents": 150000,
      "expectedBalanceCents": 290000
    }
  }
}
```

## Tipos Internos

Criar um tipo de sort no contrato de listagem:

```text
TransactionListSort = 'date:desc' | 'date:asc'
```

Adicionar ao input:

```text
sort?: TransactionListSort
```

Adicionar ao output:

```text
summary: {
  pendingCents: number;
  effectiveCents: number;
  totalCents: number;
}
```

Adicionar ao output agrupado:

```text
summary: {
  currentBalanceCents: number;
  income: {
    pendingCents: number;
    effectiveCents: number;
    totalCents: number;
  };
  expense: {
    pendingCents: number;
    effectiveCents: number;
    totalCents: number;
  };
  balance: {
    pendingDeltaCents: number;
    effectiveDeltaCents: number;
    expectedBalanceCents: number;
  };
}
```

Os valores são centavos inteiros no contrato HTTP. O cálculo não deve usar ponto flutuante.

## Presentation DTO

`ListTransactionsQueryDto` deve:

- manter `@IsDateOnly()` em `dateFrom` e `dateTo`;
- manter validação de enums e UUIDs;
- adicionar validação de `sort` como enum/lista fechada;
- documentar `sort` no Swagger.

`ListTransactionsResponseDto` deve:

- adicionar classe interna de `summary`;
- expor `summary.pendingCents`, `summary.effectiveCents` e `summary.totalCents`;
- mapear `summary` a partir do output do use case.

## Application Layer

`ListTransactionsUseCase` deve:

1. resolver `page` e `limit` com os defaults atuais;
2. resolver `sort` com default `date:desc`;
3. chamar `transactionRepository.list` com filtros, paginação e sort;
4. calcular `totalPages`, `hasNextPage` e `hasPreviousPage`;
5. retornar `items`, `total`, paginação e `summary`.

O use case não deve recalcular summary em memória a partir de `items`, porque `items` representa somente a página atual.

## Repository

`ITransactionRepository.list` deve retornar:

```text
items: Transaction[]
total: number
summary: TransactionListSummary
```

A implementação TypeORM deve:

- construir uma query base com `user_id`, `deleted_at IS NULL` e filtros enviados;
- usar a query base para buscar a página;
- usar os mesmos filtros para buscar `total`;
- usar os mesmos filtros para calcular o `summary`, sem `skip/take/orderBy`.

Pode ser usado um helper privado para aplicar filtros em query builders diferentes e evitar divergência entre listagem, count e summary.

## Query Strategy

### Listagem

Manter query paginada com:

```text
WHERE transaction.user_id = :userId
AND transaction.deleted_at IS NULL
...
ORDER BY transaction.date <direction>, transaction.id <direction>
OFFSET ...
LIMIT ...
```

### Summary Com Type Explícito

Calcular em query agregada usando `SUM(amount_cents)` em centavos.

Separar por status:

```text
pendingCents = SUM(amount_cents WHERE status = 'PENDING')
effectiveCents = SUM(amount_cents WHERE status = 'EFFECTIVE')
totalCents = pendingCents + effectiveCents
```

Esse summary não aplica sinal negativo. Ele responde “quanto existe desse type filtrado”.

### Summary Sem Type

Quando `type` não for enviado, a query de listagem e count deve adicionar:

```text
transaction.type IN ('INCOME', 'EXPENSE')
```

O summary agrupado deve calcular:

```text
income.pendingCents = SUM(INCOME PENDING amount_cents)
income.effectiveCents = SUM(INCOME EFFECTIVE amount_cents)
expense.pendingCents = SUM(EXPENSE PENDING amount_cents)
expense.effectiveCents = SUM(EXPENSE EFFECTIVE amount_cents)
```

Depois:

```text
income.totalCents = income.pendingCents + income.effectiveCents
expense.totalCents = expense.pendingCents + expense.effectiveCents
pendingDeltaCents = income.pendingCents - expense.pendingCents
effectiveDeltaCents = income.effectiveCents - expense.effectiveCents
expectedBalanceCents = currentBalanceCents + pendingDeltaCents
```

### Current Balance

`currentBalanceCents` deve ser calculado a partir de accounts e transactions efetivas não deletadas:

```text
initial_balance_cents
+ EFFECTIVE INCOME
- EFFECTIVE EXPENSE
- EFFECTIVE TRANSFER como origem
+ EFFECTIVE TRANSFER como destino
+ EFFECTIVE ADJUSTMENT INCREASE
- EFFECTIVE ADJUSTMENT DECREASE
```

Com `accountId`, calcular somente para a account filtrada.

Sem `accountId`, calcular agregado das accounts do usuário.

Usar `COALESCE(..., 0)` para retornar zero quando não houver match.

### Bigint E Precisão

`amount_cents` é `bigint`.

O cálculo deve acontecer no banco ou com `bigint`/inteiro seguro, nunca com `float`.

Como o contrato atual de dinheiro usa `number` em centavos, a implementação deve converter o resultado agregado para number somente após garantir que o valor é inteiro e seguro para o contrato atual.

Se a conversão segura não couber no contrato atual, registrar nova decisão antes de implementar alternativa com string.

## Validação

Erros esperados:

- `VALIDATION_ERROR` para `dateFrom` ou `dateTo` inválidos;
- `VALIDATION_ERROR` para `sort` inválido;
- `VALIDATION_ERROR` para `page`/`limit` inválidos;
- `UNAUTHORIZED` para sessão ausente ou inválida.

Não há novos erros de domínio nesta feature.

## Segurança

- `userId` continua vindo de `@CurrentUser()`.
- Todas as queries filtram por `transaction.user_id = :userId`.
- `accountId` e `categoryId` são filtros, não fonte de ownership.
- Mesmo que um UUID de outro usuário seja enviado, a query deve retornar lista vazia e summary zero.

## Performance

Não criar cache nesta feature.

Motivo:

- transactions mudam com frequência;
- filtros podem variar muito;
- summary precisa refletir imediatamente create/update/confirm/delete.

Usar índices existentes:

- `idx_transactions_user_date_id`;
- `idx_transactions_user_status_date`;
- `idx_transactions_account_effective`;
- `idx_transactions_destination_account_effective`;
- `idx_transactions_category_date`.

Não há migration prevista.

Se testes ou análise posterior mostrarem lentidão real para filtros combinados, abrir spec específica de índice.

## Testes

Criar ou atualizar testes cobrindo:

- defaults de paginação e `sort`;
- `sort=date:asc`;
- `sort=date:desc`;
- rejeição de `sort` inválido no DTO/controller;
- `dateFrom` inclusivo;
- `dateTo` inclusivo;
- filtro por `type`;
- filtro por `status`;
- filtro por `accountId` incluindo origem e destino;
- filtro por `categoryId`;
- `summary` simples com `INCOME`;
- `summary` simples com `EXPENSE`;
- `summary` agrupado sem `type`;
- `summary.balance` com deltas positivos e negativos;
- `currentBalanceCents` com e sem `accountId`;
- `summary` separado entre pending/effective;
- `summary` ignorando paginação;
- transactions deletadas fora da listagem e do summary;
- isolamento por usuário.

## Documentação

Atualizar durante a implementação:

- `docs/integrations/transactions/list-transactions.md`;
- `docs/integrations/transactions/README.md`, se o modelo geral precisar mencionar summary;
- Swagger em `ListTransactionsQueryDto` e `ListTransactionsResponseDto`.

Não é necessário alterar `docs/database/schema.md`, porque não há mudança de schema.

## Aprovação

Não implementar antes da revisão/aprovação de:

- [requirements.md](./requirements.md)
- [design.md](./design.md)
- [tasks.md](./tasks.md)
