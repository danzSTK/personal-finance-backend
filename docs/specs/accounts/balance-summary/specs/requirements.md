---
area: accounts
feature: balance-summary
type: spec-requirements
status: current
related:
  - ../../../../accounts/README.md
  - ../../../../accounts/concepts/account-balance.md
  - ../../../../accounts/decisions/account-balance-is-derived.md
  - ../../../../transactions/README.md
  - ../../../../transactions/reference/invariants.md
  - ../../../../integrations/accounts/list-accounts.md
---

# Requirements - Account Balance Summary

## Objetivo

Adicionar ao retorno de accounts o saldo atual da conta e, quando solicitado, uma projeção de saldo até uma data informada pelo cliente.

A feature deve preservar a regra central do domínio: saldo de account é derivado de `initialBalanceCents` e do histórico de transactions, nunca persistido como coluna na account.

## Contexto Atual

Hoje `GET /accounts` retorna um array de accounts com dados cadastrais:

- `id`;
- `name`;
- `type`;
- `initialBalanceCents`;
- `color`;
- `icon`;
- `includeInTotal`;
- `isArchived`;
- `isDefault`;
- `createdAt`;
- `updatedAt`.

O módulo `transactions` já persiste lançamentos com:

- `amount_cents`;
- `type`;
- `status`;
- `date`;
- `destination_account_id`;
- `direction`;
- `deleted_at`.

## Escopo

Esta spec cobre:

- saldo atual por account em `GET /accounts`;
- saldo projetado por account quando o frontend informar uma data limite;
- cálculo usando `initialBalanceCents` + transactions relevantes;
- suporte a `INCOME`, `EXPENSE`, `TRANSFER` e `ADJUSTMENT`;
- migração de `accounts.initial_balance` para `accounts.initial_balance_cents`;
- filtro por usuário autenticado;
- documentação de integração para o frontend.

## Fora Do Escopo

Esta spec não cobre:

- snapshots de saldo;
- saldo total consolidado do usuário;
- relatórios financeiros;
- gráficos por período;
- projeção sem data limite;
- cálculo de saldo de cartão de crédito com regra própria de fatura.

## Regras De Negócio

### Saldo Atual

Saldo atual representa o saldo real conhecido da account no momento da consulta.

O saldo atual deve considerar:

- `initialBalanceCents`;
- transactions `EFFECTIVE`;
- transactions não deletadas;
- impacto financeiro da transaction conforme seu `type`;
- transferências em que a account é origem ou destino;
- ajustes conforme `direction`.

O saldo atual não deve considerar:

- transactions `PENDING`;
- transactions deletadas;
- transactions de outro usuário.

### Saldo Projetado

Saldo projetado representa uma projeção até uma data específica.

O saldo projetado deve considerar:

- o mesmo cálculo do saldo atual;
- transactions `PENDING` com `date <= projectedUntil`;
- transactions `EFFECTIVE` com `date <= projectedUntil`.

O saldo projetado não significa “saldo real da conta”. Ele é uma leitura de planejamento até a data enviada.

### Data Da Projeção

O frontend deve enviar uma data limite quando quiser projeção.

O backend deve retornar essa data em `balance.projectedUntil`.

IF o frontend não enviar data de projeção
THEN o backend deve retornar apenas `balance.currentCents`.

IF o frontend enviar data de projeção
THEN o backend deve retornar `balance.currentCents`, `balance.projectedCents` e `balance.projectedUntil`.

### Datas Passadas

IF `projectedUntil` estiver no passado
THEN `balance.projectedCents` representa a leitura histórica até aquela data.

Essa leitura deve usar transactions não deletadas com `date <= projectedUntil`, independentemente de o frontend chamar isso de histórico ou projeção.

O backend não deve tentar decidir o rótulo visual. O frontend decide se exibe como saldo histórico, saldo previsto ou projeção.

### Pendências Futuras

Pendências depois de `projectedUntil` não entram no cálculo.

Isso evita que “todas as pendentes” misture lançamentos de meses futuros em uma projeção curta.

### Impacto Por Tipo

Para uma account consultada:

- `INCOME`: soma `amount_cents` quando `account_id` é a account.
- `EXPENSE`: subtrai `amount_cents` quando `account_id` é a account.
- `TRANSFER`: subtrai quando a account é `account_id` e soma quando a account é `destination_account_id`.
- `ADJUSTMENT`: soma quando `direction = INCREASE` e subtrai quando `direction = DECREASE`.

## Contrato Esperado

Cada account deve retornar:

```json
{
  "id": "account-id",
  "name": "Carteira",
  "balance": {
    "currentCents": 125000,
    "projectedCents": 98000,
    "projectedUntil": "2026-06-30"
  }
}
```

`balance.currentCents` e `balance.projectedCents` devem ser inteiros em centavos.

## Requisitos Funcionais

### REQ-001 - Retornar saldo atual na listagem de accounts

WHEN o usuário autenticado listar accounts
THE SYSTEM SHALL retornar `balance.currentCents` para cada account retornada.

### REQ-002 - Retornar saldo projetado quando solicitado

WHEN o usuário autenticado listar accounts com `projectedUntil`
THE SYSTEM SHALL retornar `balance.projectedCents` e `balance.projectedUntil` para cada account retornada.

### REQ-003 - Limitar projeção pela data enviada

WHEN o cálculo de saldo projetado for executado
THE SYSTEM SHALL considerar somente transactions com `date <= projectedUntil`.

### REQ-004 - Ignorar pendências no saldo atual

WHEN o cálculo de saldo atual for executado
THE SYSTEM SHALL ignorar transactions `PENDING`.

### REQ-005 - Proteger multi-tenancy

WHEN calcular saldos de accounts
THE SYSTEM SHALL usar somente accounts e transactions do usuário autenticado.

### REQ-006 - Manter accounts arquivadas conforme filtro atual

WHEN `includeArchived` não for enviado ou for `false`
THE SYSTEM SHALL retornar somente accounts ativas com saldo.

WHEN `includeArchived=true`
THE SYSTEM SHALL incluir accounts arquivadas com saldo.

## Expectativas De API/Frontend

- O frontend deve enviar `projectedUntil` como `YYYY-MM-DD`.
- O frontend não deve calcular saldo por conta localmente quando receber `balance`.
- O frontend decide como rotular a leitura quando `projectedUntil` está no passado, presente ou futuro.
- O frontend deve tratar valores monetários como inteiros em centavos.

## Critérios De Aceite

- `GET /accounts` retorna `balance.currentCents`.
- `GET /accounts?projectedUntil=YYYY-MM-DD` retorna `balance.projectedCents` e `balance.projectedUntil`.
- O cálculo considera `TRANSFER` nos dois lados.
- O cálculo considera `ADJUSTMENT` conforme `direction`.
- Transactions `PENDING` não alteram `current`.
- Transactions `PENDING` entram em `projected` somente até `projectedUntil`.
- Swagger e `docs/integrations/accounts/list-accounts.md` são atualizados.
- Testes cobrem pelo menos income, expense, transfer, adjustment, pending e deleted transaction.
