---
area: transactions
feature: list-filters-summary
type: spec-requirements
status: approved
related:
  - ../../../../transactions/README.md
  - ../../../../transactions/reference/invariants.md
  - ../../../../transactions/reference/schema.md
  - ../../../../transactions/concepts/transaction-date.md
  - ../../../../transactions/concepts/transaction-type.md
  - ../../../../transactions/concepts/transaction-status.md
  - ../../../../transactions/decisions/pending-transactions-do-not-affect-current-balance.md
  - ../../../../transactions/decisions/transfers-are-neutral.md
  - ../../../../transactions/decisions/adjustments-are-technical-transactions.md
  - ../../../../integrations/transactions/list-transactions.md
---

# Requirements - Transaction List Filters And Summary

## Objetivo

Evoluir `GET /transactions` para consolidar o contrato de filtros da listagem, adicionar ordenação configurável por data e retornar um `summary` financeiro da mesma consulta.

O retorno deve permitir que o frontend exiba a página de transactions e, junto dela, um summary claro por intenção financeira: receitas, despesas e impacto de saldo.

## Contexto Atual

Hoje `GET /transactions` já lista transactions não deletadas do usuário autenticado com:

- `status`;
- `type`;
- `accountId`;
- `categoryId`;
- `dateFrom`;
- `dateTo`;
- `page`;
- `limit`.

A implementação atual ordena por `date DESC` e `id DESC`.

O contrato ainda não retorna `summary` e não permite alterar a ordenação.

## Escopo

Esta spec cobre:

- manter filtros por `dateFrom`, `dateTo`, `type`, `status`, `accountId` e `categoryId`;
- manter paginação por `page` e `limit`;
- adicionar query `sort`;
- quando `type` não for enviado, listar apenas `INCOME` e `EXPENSE`;
- quando `type` não for enviado, retornar summary agrupado por `income`, `expense` e `balance`;
- quando `type` for enviado, retornar summary simples com `pendingCents`, `effectiveCents` e `totalCents`;
- calcular summaries em centavos positivos por tipo e deltas de saldo em campos próprios;
- preservar `DateOnly` para `dateFrom` e `dateTo`;
- atualizar Swagger e documentação de integração.

## Fora Do Escopo

Esta spec não cobre:

- novos filtros por descrição, valor, `createdAt`, `effectiveAt` ou `destinationAccountId`;
- busca textual;
- relatórios analíticos;
- agrupamento por category, account, mês ou type;
- snapshots ou cache de summary;
- alteração de schema;
- alteração dos endpoints de create, update, confirm, get ou delete.

## Regras De Negócio

### Ownership

- A listagem deve retornar somente transactions do usuário autenticado.
- `userId` sempre vem da sessão autenticada.
- Nenhum filtro pode permitir leitura cross-user.

### Delete

- Transactions com `deleted_at IS NOT NULL` não aparecem na listagem.
- Transactions deletadas não entram no `summary`.

### DateOnly

- `dateFrom` e `dateTo` são `DateOnly` no formato `YYYY-MM-DD`.
- `dateFrom` é inclusivo.
- `dateTo` é inclusivo.
- O backend não deve converter `dateFrom` ou `dateTo` para `Date` JavaScript.
- A comparação deve ser feita contra `transactions.date` como data civil.

### Filtros

- `status` filtra por `PENDING` ou `EFFECTIVE`.
- `type` filtra por `INCOME`, `EXPENSE`, `TRANSFER` ou `ADJUSTMENT`.
- Quando `type` não for enviado, a listagem deve retornar somente transactions `INCOME` e `EXPENSE`.
- `accountId` filtra transactions em que a account participa como origem ou destino.
- `categoryId` filtra por category da transaction.
- Os filtros devem ser combinados com semântica `AND`.

### Paginação

- `page` começa em `1`.
- `limit` mantém default `20` e máximo `100`.
- `meta.total` representa a quantidade total de transactions que atendem aos filtros, sem aplicar `page` e `limit`.
- `data` representa somente a página solicitada.

### Sort

- `sort` deve aceitar `date:desc` e `date:asc`.
- Quando `sort` não for enviado, a ordenação padrão deve continuar sendo `date:desc`.
- A ordenação deve ser estável usando `id` como desempate.
- `sort=date:desc` ordena por `date DESC, id DESC`.
- `sort=date:asc` ordena por `date ASC, id ASC`.

### Summary Com Type Explícito

Quando `type` for enviado, o response deve incluir o modelo simples:

```json
{
  "summary": {
    "pendingCents": 0,
    "effectiveCents": 0,
    "totalCents": 0
  }
}
```

`summary` deve ser calculado sobre todas as transactions que atendem aos filtros da requisição, sem aplicar `page` e `limit`.

`sort` não altera o `summary`.

`pendingCents` é o somatório positivo das transactions filtradas com `status = PENDING`.

`effectiveCents` é o somatório positivo das transactions filtradas com `status = EFFECTIVE`.

`totalCents` é `pendingCents + effectiveCents`.

### Summary Sem Type

Quando `type` não for enviado, o response deve incluir o modelo agrupado:

```json
{
  "summary": {
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
      "expectedBalanceCents": 190000
    }
  }
}
```

`income` soma somente transactions `INCOME`.

`expense` soma somente transactions `EXPENSE`.

`income.*Cents` e `expense.*Cents` são sempre valores positivos ou zero.

`balance.pendingDeltaCents` é `income.pendingCents - expense.pendingCents`.

`balance.effectiveDeltaCents` é `income.effectiveCents - expense.effectiveCents`.

`balance.expectedBalanceCents` é `balance.effectiveDeltaCents + balance.pendingDeltaCents`.

`balance.expectedBalanceCents` representa o resultado líquido esperado da listagem/período, não o saldo projetado da account.

Saldo atual e saldo projetado pertencem ao contrato de accounts.

## Compatibilidade De Contrato

`summary` tem shape diferente conforme presença de `type`.

IF `type` for enviado
THEN o sistema retorna o modelo simples.

IF `type` não for enviado
THEN o sistema retorna o modelo agrupado.

## Requisitos Funcionais

### REQ-001 - Listar com filtros combinados

WHEN o usuário autenticado listar transactions com filtros
THE SYSTEM SHALL retornar somente transactions não deletadas do usuário que atendam a todos os filtros enviados.

IF `type` não for enviado
THEN o sistema deve restringir a listagem a transactions `INCOME` e `EXPENSE`.

### REQ-002 - Filtrar por intervalo DateOnly

WHEN `dateFrom` e/ou `dateTo` forem enviados
THE SYSTEM SHALL filtrar por `transactions.date` usando comparação inclusiva de `DateOnly`.

IF `dateFrom` ou `dateTo` não estiverem no formato `YYYY-MM-DD` válido
THEN o sistema deve responder erro de validação.

### REQ-003 - Ordenar por data

WHEN `sort=date:asc` for enviado
THE SYSTEM SHALL ordenar por `date ASC, id ASC`.

WHEN `sort=date:desc` for enviado ou omitido
THE SYSTEM SHALL ordenar por `date DESC, id DESC`.

IF `sort` tiver valor diferente dos suportados
THEN o sistema deve responder erro de validação.

### REQ-004 - Retornar meta paginada

WHEN a listagem for executada
THE SYSTEM SHALL retornar `meta.total`, `meta.page`, `meta.limit`, `meta.totalPages`, `meta.hasNextPage` e `meta.hasPreviousPage`.

### REQ-005 - Retornar summary da consulta filtrada

WHEN a listagem for executada com `type` explícito
THE SYSTEM SHALL retornar `summary.pendingCents`, `summary.effectiveCents` e `summary.totalCents`.

THE SYSTEM SHALL calcular o summary simples com os mesmos filtros de `status`, `type`, `accountId`, `categoryId`, `dateFrom` e `dateTo`.

THE SYSTEM SHALL ignorar `page`, `limit` e `sort` no cálculo do `summary`.

### REQ-006 - Retornar summary agrupado sem type

WHEN a listagem for executada sem `type`
THE SYSTEM SHALL retornar `summary.income`, `summary.expense` e `summary.balance`.

THE SYSTEM SHALL calcular `income` e `expense` com os mesmos filtros de `status`, `accountId`, `categoryId`, `dateFrom` e `dateTo`.

THE SYSTEM SHALL ignorar `page`, `limit` e `sort` no cálculo do summary agrupado.

THE SYSTEM SHALL calcular `balance.pendingDeltaCents` como `income.pendingCents - expense.pendingCents`.

THE SYSTEM SHALL calcular `balance.effectiveDeltaCents` como `income.effectiveCents - expense.effectiveCents`.

THE SYSTEM SHALL calcular `balance.expectedBalanceCents` como `balance.effectiveDeltaCents + balance.pendingDeltaCents`.

## Expectativas De API/Frontend

- O frontend deve enviar `dateFrom` e `dateTo` como `YYYY-MM-DD`, sem hora e sem timezone.
- O frontend deve tratar `income.*Cents`, `expense.*Cents` e summary simples como valores positivos ou zero.
- O frontend deve tratar `balance.pendingDeltaCents` e `balance.effectiveDeltaCents` como deltas que podem ser positivos, negativos ou zero.
- O frontend deve entender que `summary` representa a consulta filtrada inteira, não apenas a página atual.
- O frontend deve usar `GET /accounts/summary` para saldo atual ou saldo projetado agregado.
- O frontend pode usar `status=PENDING` ou `status=EFFECTIVE` para obter um lado específico dos summaries, sabendo que o outro lado será `0`.
- O frontend deve usar `sort=date:desc` para histórico mais recente primeiro e `sort=date:asc` para leitura cronológica.

## Critérios De Aceite

- `GET /transactions` sem `type` lista apenas `INCOME` e `EXPENSE`.
- `GET /transactions` sem `type` retorna summary agrupado com `income`, `expense` e `balance`.
- `GET /transactions?type=INCOME` retorna summary simples com valores positivos.
- `GET /transactions?type=EXPENSE` retorna summary simples com valores positivos.
- `GET /transactions?sort=date:asc` retorna a lista em ordem crescente por `date` e `id`.
- `GET /transactions?sort=date:desc` mantém a ordem atual.
- `dateFrom` e `dateTo` continuam sendo validados como `DateOnly`.
- `summary` considera todos os filtros da consulta e ignora paginação.
- `summary.balance.expectedBalanceCents` representa o resultado líquido esperado da consulta, sem somar saldo atual.
- Swagger e `docs/integrations/transactions/list-transactions.md` são atualizados.
- Testes cobrem filtros, sort, paginação e summary por type/status.
