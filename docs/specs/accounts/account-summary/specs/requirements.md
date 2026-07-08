---
area: accounts
feature: account-summary
type: spec-requirements
status: current
related:
  - ../../../../accounts/README.md
  - ../../../../accounts/concepts/account-balance.md
  - ../../../../accounts/decisions/account-balance-is-derived.md
  - ../../../../accounts/reference/invariants.md
  - ../../../../specs/accounts/balance-summary/specs/requirements.md
  - ../../../../transactions/README.md
  - ../../../../specs/transactions/list-filters-summary/specs/requirements.md
  - ../../../../integrations/accounts/list-accounts.md
  - ../../../../integrations/transactions/list-transactions.md
---

# Requirements - Account Summary

## Objetivo

Criar `GET /accounts/summary` para retornar o saldo agregado do usuário a partir das accounts e do histórico de transactions.

O módulo `accounts` passa a ser a única fonte HTTP para perguntas de saldo atual e saldo projetado:

- quanto uma account tem agora;
- quanto uma account terá em uma data;
- quanto o usuário tem agora;
- quanto o usuário terá em uma data.

Como consequência, `GET /transactions` deve deixar de retornar `summary.currentBalanceCents`. O summary de transactions deve responder somente a pergunta: "dentro deste filtro, qual foi o movimento?".

## Contexto Atual

`GET /accounts` já retorna `balance.currentCents` por account e, quando `projectedUntil` é enviado, também retorna `balance.projectedCents`.

`GET /transactions` retorna um summary agrupado sem `type` com:

- `currentBalanceCents`;
- `income`;
- `expense`;
- `balance.pendingDeltaCents`;
- `balance.effectiveDeltaCents`;
- `balance.expectedBalanceCents`.

Esse contrato mistura duas naturezas:

- saldo atual real, que pertence ao domínio de accounts;
- movimento filtrado, que pertence ao domínio de transactions.

## Escopo

Esta spec cobre:

- criar `GET /accounts/summary`;
- retornar saldo atual agregado em `currentCents`;
- retornar saldo projetado agregado em `projectedCents` quando `projectedUntil` for enviado;
- aplicar filtros de conjunto de accounts por `includeArchived` e `includeExcludedFromTotal`;
- preservar a fórmula de saldo atual já usada por `AccountBalanceRepository`;
- remover `currentBalanceCents` do summary agrupado de `GET /transactions`;
- atualizar contratos HTTP, Swagger e docs de integração.

## Fora Do Escopo

Esta spec não cobre:

- snapshots de saldo;
- cache de saldo agregado;
- alteração de schema;
- novas regras para cartão de crédito;
- relatórios por período, categoria, mês ou account;
- cálculo de patrimônio com ativos/investimentos;
- remoção de `balance.currentCents` do `GET /accounts`;
- alteração dos filtros de listagem de transactions.

## Regras De Negócio

### Saldo Atual Agregado

Saldo atual agregado representa a soma dos saldos atuais das accounts selecionadas.

A verdade do saldo atual continua sendo:

```text
initialBalanceCents + impacts de transactions EFFECTIVE não deletadas
```

Para cada account selecionada:

- `INCOME` efetiva soma;
- `EXPENSE` efetiva subtrai;
- `TRANSFER` efetiva subtrai na origem e soma no destino;
- `ADJUSTMENT` efetivo soma ou subtrai conforme `direction`.

Transactions `PENDING` não afetam `currentCents`.

Transactions deletadas não afetam `currentCents`.

Transactions de outro usuário nunca entram no cálculo.

### Saldo Projetado Agregado

Saldo projetado agregado representa a soma dos saldos projetados das accounts selecionadas até `projectedUntil`.

Quando `projectedUntil` for enviado, o cálculo deve considerar:

- `initialBalanceCents`;
- transactions `EFFECTIVE` com `date <= projectedUntil`;
- transactions `PENDING` com `date <= projectedUntil`;
- transactions não deletadas;
- impacto financeiro por `type`, `direction`, origem e destino.

Quando `projectedUntil` não for enviado, o response não deve retornar `projectedCents` nem `projectedUntil`.

### Filtros De Accounts

Os filtros de `GET /accounts/summary` definem apenas o conjunto de accounts somadas. Eles não mudam a fórmula de saldo.

Por padrão:

- accounts arquivadas não entram no saldo agregado;
- accounts com `includeInTotal=false` não entram no saldo agregado.

O cliente pode ampliar o conjunto com:

- `includeArchived=true`: inclui accounts arquivadas;
- `includeExcludedFromTotal=true`: inclui accounts com `includeInTotal=false`;
- ambos `true`: inclui accounts arquivadas e accounts excluídas do total.

Accounts que não pertencem ao usuário autenticado nunca entram no cálculo.

### Transactions E Summary

`GET /transactions` deve continuar respondendo o movimento financeiro filtrado.

Quando `type` não for enviado, o summary agrupado deve conter:

- `income`;
- `expense`;
- `balance.pendingDeltaCents`;
- `balance.effectiveDeltaCents`;
- `balance.expectedBalanceCents`.

`GET /transactions` não deve retornar `currentBalanceCents`.

`balance.expectedBalanceCents` continua representando o resultado líquido esperado da consulta filtrada, não saldo atual nem saldo projetado de account.

## Contrato Esperado

### GET /accounts/summary

Sem projeção:

```json
{
  "object": "account.summary",
  "currentCents": 250000
}
```

Com projeção:

```json
{
  "object": "account.summary",
  "currentCents": 250000,
  "projectedCents": 210000,
  "projectedUntil": "2026-06-30"
}
```

### GET /transactions

Sem `type`, o summary agrupado esperado passa a ser:

```json
{
  "summary": {
    "object": "transaction_summary.overview",
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

## Requisitos Funcionais

### REQ-001 - Retornar saldo atual agregado

WHEN o usuário autenticado chamar `GET /accounts/summary`
THE SYSTEM SHALL retornar `currentCents` com o saldo atual agregado das accounts selecionadas pelos filtros.

### REQ-002 - Respeitar filtros padrão

WHEN `includeArchived` não for enviado ou for `false`
THE SYSTEM SHALL excluir accounts arquivadas do agregado.

WHEN `includeExcludedFromTotal` não for enviado ou for `false`
THE SYSTEM SHALL excluir accounts com `includeInTotal=false` do agregado.

### REQ-003 - Permitir incluir arquivadas

WHEN `includeArchived=true`
THE SYSTEM SHALL incluir accounts arquivadas no conjunto somado.

### REQ-004 - Permitir incluir excluídas do total

WHEN `includeExcludedFromTotal=true`
THE SYSTEM SHALL incluir accounts com `includeInTotal=false` no conjunto somado.

### REQ-005 - Permitir combinar filtros

WHEN `includeArchived=true` e `includeExcludedFromTotal=true`
THE SYSTEM SHALL incluir accounts arquivadas e accounts com `includeInTotal=false`.

### REQ-006 - Retornar saldo projetado agregado quando solicitado

WHEN `projectedUntil` for enviado
THE SYSTEM SHALL retornar `projectedCents` e `projectedUntil`.

### REQ-007 - Limitar projeção pela data

WHEN calcular `projectedCents`
THE SYSTEM SHALL considerar somente transactions não deletadas com `date <= projectedUntil`.

### REQ-008 - Proteger multi-tenancy

WHEN calcular o saldo agregado
THE SYSTEM SHALL usar somente accounts e transactions do usuário autenticado.

### REQ-009 - Remover currentBalanceCents de transactions

WHEN o usuário chamar `GET /transactions` sem `type`
THE SYSTEM SHALL retornar summary agrupado sem `currentBalanceCents`.

### REQ-010 - Manter summary de transactions baseado em movimento filtrado

WHEN `GET /transactions` calcular summary
THE SYSTEM SHALL calcular receitas, despesas e deltas somente a partir das transactions que atendem aos filtros da query, ignorando `page`, `limit` e `sort`.

## Edge Cases

- Usuário sem accounts selecionáveis pelo filtro deve receber `currentCents: 0`.
- Usuário sem accounts selecionáveis pelo filtro e com `projectedUntil` deve receber `currentCents: 0` e `projectedCents: 0`.
- Accounts sem transactions entram com `initialBalanceCents`.
- Transferências entre duas accounts selecionadas devem ter efeito líquido zero no agregado.
- Transferência entre uma account selecionada e outra excluída pelo filtro deve afetar o agregado pela perspectiva da account selecionada.
- `projectedUntil` no passado representa leitura histórica até aquela data.
- `projectedUntil` inválido deve retornar erro de validação.

## Expectativas De API/Frontend

- O frontend deve usar `GET /accounts/summary` para cards de saldo atual e saldo projetado agregado.
- O frontend deve usar `GET /accounts` quando precisar de saldo por account.
- O frontend deve usar `GET /transactions` para totais de movimento dentro de filtros.
- O frontend deve enviar `projectedUntil` como `YYYY-MM-DD`.
- O frontend deve tratar valores monetários como inteiros em centavos.
- Depois desta mudança, o frontend não deve esperar `summary.currentBalanceCents` em `GET /transactions`.

## Critérios De Aceite

- `GET /accounts/summary` retorna `object = account.summary` e `currentCents`.
- `GET /accounts/summary?projectedUntil=YYYY-MM-DD` retorna `projectedCents` e `projectedUntil`.
- Por padrão, o agregado exclui accounts arquivadas e accounts com `includeInTotal=false`.
- `includeArchived=true` inclui arquivadas.
- `includeExcludedFromTotal=true` inclui accounts fora do total.
- Os dois filtros podem ser combinados.
- O cálculo considera income, expense, transfer, adjustment, pending, effective e deleted conforme as regras.
- `GET /transactions` sem `type` não retorna `currentBalanceCents`.
- Docs de integração e Swagger refletem o novo contrato.
- Testes cobrem saldo agregado e remoção de `currentBalanceCents`.
