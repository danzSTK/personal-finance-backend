---
area: transactions
feature: balance-adjustment
type: spec-decisions
status: current
related:
  - ./requirements.md
  - ./design.md
---

# Decisions - Balance Adjustment

## DEC-001 - Rota dedicada sob `/transactions` em vez de `/accounts`

Status: accepted

Decision:
Expor o reajuste automático em `POST /transactions/balance-adjustments` no `TransactionsController`, recebendo `accountId` no body.

Reason:
`TransactionsModule` é o módulo proprietário do ciclo de vida de transactions e já depende de `AccountsModule` e `CategoriesModule`. Manter a rota em `TransactionsController` evita dependência circular entre `accounts` e `transactions` e preserva o prefixo HTTP por módulo.

Impact:
O endpoint segue o mesmo padrão de entrada e resposta de `POST /transactions`, mantendo `POST /transactions` com `type = ADJUSTMENT` disponível para ajustes manuais por delta.

## DEC-002 - Erro `409 Conflict` quando `targetBalanceCents === currentCents`

Status: accepted

Decision:
Rejeitar requisições em que o saldo alvo já corresponde ao saldo atual com `BalanceAdjustmentNoDifferenceError` (`code = BALANCE_ADJUSTMENT_NO_DIFFERENCE`, HTTP `409 Conflict`).

Reason:
Transactions exigem `amount_cents > 0` no domínio e no banco. Retornar um erro semântico explícito mantém o contrato de sucesso homogêneo (`201 Created` sempre devolve uma `TransactionResponseDto`) e permite ao frontend tratar o estado pelo `code`.

Impact:
Novo código de erro adicionado ao `AppExceptionFilter` e à documentação de erros de integração.

## DEC-003 - Saldo alvo pode ser negativo, zero ou positivo

Status: accepted

Decision:
Aceitar qualquer inteiro seguro em `targetBalanceCents` (`Number.MIN_SAFE_INTEGER` até `Number.MAX_SAFE_INTEGER`), validando com `BigInt` que `|targetBalanceCents - currentCents| <= TRANSACTION_AMOUNT_CENTS_MAX`.

Reason:
Contas bancárias podem operar com saldo negativo (ex.: cheque especial). Restringir `targetBalanceCents >= 0` impediria conciliar contas negativadas.

Impact:
O DTO preserva o valor bruto antes da conversão implícita do `ValidationPipe` para que `0` e negativos sejam aceitos sem que `null`, `""` ou booleanos sejam coagidos silenciosamente para `0`/`1`.

## DEC-004 - `description` opcional com fallback `"Reajuste de saldo"`

Status: accepted

Decision:
Tornar `description` opcional em `POST /transactions/balance-adjustments`. Quando omitida, `null` ou vazia após `trim()`, gravar `"Reajuste de saldo"`.

Reason:
Reduz atrito na experiência de reajuste rápido sem violar a invariante de domínio nem a constraint `CHK_transactions_adjustment_description` que exige descrição não vazia em `ADJUSTMENT`.

Impact:
A entidade `Transaction` e o `POST /transactions` manual continuam exigindo `description` não vazia; o fallback aplica-se exclusivamente ao caso de uso de reajuste automático.

## DEC-005 - `date` obrigatória em `DateOnly` (`YYYY-MM-DD`)

Status: accepted

Decision:
Exigir `date` no formato `DateOnly` (`YYYY-MM-DD`) no payload de `POST /transactions/balance-adjustments`.

Reason:
O backend opera em UTC e não possui timezone do usuário; derivar "hoje" no servidor poderia registrar o reajuste no dia seguinte para usuários em fusos negativos (ex.: Brasil após 21h).

Impact:
Contrato alinhado a `docs/integrations/date-and-time.md` e aos demais endpoints de transactions.

## DEC-006 - Resposta retorna diretamente `TransactionResponseDto`

Status: accepted

Decision:
Retornar `201 Created` com `TransactionResponseDto`, idêntico ao `POST /transactions`.

Reason:
Simplicidade de contrato e reuso direto do modelo de transação já consumido pelo frontend.

Impact:
O frontend recebe a transaction `ADJUSTMENT` criada (com `amountCents`, `direction`, `description`, `effectiveAt`, etc.) e pode invalidar/atualizar saldos e listagens pelo mesmo fluxo já existente.

## DEC-007 - Lock pessimista na account durante leitura do saldo e criação do ajuste

Status: accepted

Decision:
Executar validação/lock da account (`SELECT ... FOR UPDATE`), cálculo do saldo atual (`getSummaries` com o mesmo `EntityManager`) e inserção da transaction na mesma transação SQL.

Reason:
Evita que duas chamadas simultâneas de reajuste para a mesma conta leiam o mesmo saldo anterior e gravem ajustes duplicados, deixando o saldo final incorreto.

Impact:
`IAccountRepository` ganha `findByIdAndUserIdForUpdate` e `IAccountBalanceRepository.getSummaries` aceita `options?: IRepositoryOptions`.
