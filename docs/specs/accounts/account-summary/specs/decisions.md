---
area: accounts
feature: account-summary
type: spec-decisions
status: current
related:
  - ./requirements.md
  - ./design.md
---

# Decisions - Account Summary

## DEC-001 - Accounts é a fonte de saldo atual e projetado

Status: accepted

Decision:
Saldo atual e saldo projetado serão expostos pelo módulo `accounts`.

Reason:
Saldo é estado de account derivado de `initialBalanceCents` e transactions. Transactions respondem movimentações e deltas dentro de filtros, não o estado atual do usuário.

Impact:
`GET /accounts`, `GET /accounts/summary` e futuras leituras de saldo ficam no mesmo bounded context.

## DEC-002 - Remover currentBalanceCents de GET /transactions

Status: accepted

Decision:
`GET /transactions` não retornará mais `summary.currentBalanceCents`.

Reason:
O campo mistura saldo real atual com summary filtrado de movimentações. Ele também duplica a regra de saldo dentro de `TransactionRepository`.

Impact:
O frontend deve chamar `GET /accounts/summary` para saldo atual/projetado agregado e `GET /transactions` para movimento filtrado.

## DEC-003 - Filtros de accounts alteram o conjunto, não a fórmula

Status: accepted

Decision:
`includeArchived` e `includeExcludedFromTotal` controlam quais accounts entram no agregado. A fórmula de saldo permanece a mesma.

Reason:
A verdade do saldo atual não muda por parâmetro. O parâmetro só responde qual conjunto de accounts o cliente quer somar.

Impact:
A query deve ser organizada com `target_accounts` explícito antes de calcular impactos de transactions.

## DEC-004 - Defaults excluem arquivadas e excluídas do total

Status: accepted

Decision:
Por padrão, `GET /accounts/summary` exclui accounts arquivadas e accounts com `includeInTotal=false`.

Reason:
Esse é o comportamento esperado para totais agregados e relatórios gerais conforme invariantes de accounts.

Impact:
Para incluir esses grupos, o cliente deve enviar `includeArchived=true`, `includeExcludedFromTotal=true` ou ambos.

## DEC-005 - Não criar cache na primeira versão

Status: accepted

Decision:
`GET /accounts/summary` calculará o saldo na leitura, sem cache.

Reason:
Saldo muda em create/update/confirm/delete de transaction e pode envolver duas accounts em transferências. Cache exigiria invalidação cuidadosa e aumentaria o risco de inconsistência.

Impact:
A primeira versão prioriza consistência. Otimização deve vir por query agregada e índices existentes.

## DEC-006 - Não criar índice nesta spec

Status: accepted

Decision:
A spec não cria índice novo para `GET /accounts/summary`.

Reason:
Os índices existentes cobrem bem saldo atual efetivo por origem/destino. Projeção com pendências pode exigir avaliação posterior, mas índice novo deve ser baseado em `EXPLAIN (ANALYZE, BUFFERS)` com volume representativo.

Impact:
Se performance real for insuficiente, abrir spec específica de otimização de índice.

## DEC-007 - Boolean query params usam parser explícito

Status: accepted

Decision:
`includeArchived` e `includeExcludedFromTotal` devem transformar somente `true`/`false` em boolean.

Reason:
`@Type(() => Boolean)` usa coerção JavaScript e transforma a string `"false"` em `true`, o que inverteria o conjunto de accounts somadas quando o frontend enviasse `false` explicitamente.

Impact:
Valores diferentes de `true` ou `false` continuam inválidos pelo `@IsBoolean`.
