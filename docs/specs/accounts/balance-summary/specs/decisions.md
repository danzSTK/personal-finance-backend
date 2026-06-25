---
area: accounts
feature: balance-summary
type: spec-decisions
status: current
related:
  - ./requirements.md
  - ./design.md
  - ../../../../accounts/decisions/account-balance-is-derived.md
  - ../../../../transactions/decisions/pending-transactions-do-not-affect-current-balance.md
---

# Decisions - Account Balance Summary

## DEC-001 - Saldo projetado sempre terá data limite

Status: accepted

Decision:
`projected` será calculado apenas quando o cliente informar `projectedUntil`.

Reason:
Somar “todas as pendentes” mistura meses futuros e pode produzir uma leitura enganosa. Uma projeção honesta precisa dizer até quando ela está projetando.

Impact:
`GET /accounts` retorna apenas `balance.currentCents`. `GET /accounts?projectedUntil=YYYY-MM-DD` retorna também `balance.projectedCents` e `balance.projectedUntil`.

## DEC-002 - Backend calcula, frontend rotula

Status: accepted

Decision:
O backend calcula o saldo até a data enviada, mas não decide se aquilo será exibido como “saldo histórico”, “saldo previsto” ou outro rótulo visual.

Reason:
Uma data passada pode ser uma consulta histórica; uma data futura pode ser projeção. Essa linguagem é de experiência do usuário, não do cálculo.

Impact:
O contrato retorna `projectedUntil` e valores. O frontend decide a narrativa visual.

## DEC-003 - Response usa centavos

Status: accepted

Decision:
`balance.currentCents` e `balance.projectedCents` serão retornados como inteiros em centavos.

Reason:
Mantém o mesmo padrão monetário já usado por transactions e evita misturar decimal string com inteiro em centavos no contrato HTTP.

Impact:
O frontend deve tratar valores monetários como centavos e formatar para moeda conforme locale.

## DEC-004 - Não cachear saldo na primeira versão

Status: accepted

Decision:
Balance summary será calculado na leitura, sem cache.

Reason:
Transactions alteram saldo com frequência e podem impactar duas accounts em transferências. Cache exigiria invalidação mais cuidadosa.

Impact:
A primeira versão prioriza consistência. Performance será tratada por query agregada e índices existentes.

## DEC-005 - Migrar initial balance para centavos

Status: accepted

Decision:
Esta feature migra `accounts.initial_balance` para `accounts.initial_balance_cents`.

Reason:
Transactions já usam `amount_cents`. Migrar agora evita misturar unidades no cálculo de saldo e reduz uma dívida futura enquanto o volume de dados ainda é baixo.

Impact:
Banco usa `bigint`; domínio, DTOs e respostas HTTP usam `number` seguro em centavos. O contrato público de accounts troca `initialBalance` por `initialBalanceCents`.
