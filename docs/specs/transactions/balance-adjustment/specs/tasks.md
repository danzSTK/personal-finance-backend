---
area: transactions
feature: balance-adjustment
type: spec-tasks
status: current
related:
  - ./requirements.md
  - ./design.md
  - ./decisions.md
---

# Tasks - Balance Adjustment (Cálculo Automático por Saldo Alvo)

- [x] 1. Criar spec (`requirements.md`, `design.md`, `tasks.md`, `decisions.md`) e indexar em `docs/specs/README.md`
- [x] 2. Adicionar constantes de reajuste de saldo em `transaction.constants.ts`
- [x] 3. Criar erro `BalanceAdjustmentNoDifferenceError`, exportar e mapear `409 Conflict` no `AppExceptionFilter`
- [x] 4. Adicionar suporte a `findByIdAndUserIdForUpdate` em `IAccountRepository` / `AccountRepository` / `CachedAccountRepository`, suporte a `options?: IRepositoryOptions` em `IAccountBalanceRepository` / `AccountBalanceRepository`, e exportar `IAccountBalanceRepository` em `AccountsCoreModule`
- [x] 5. Adicionar `validateForBalanceAdjustment` no `TransactionReferenceValidator`
- [x] 6. Implementar `CreateBalanceAdjustmentUseCase` e seus DTOs de aplicação
- [x] 7. Implementar `CreateBalanceAdjustmentDto`, rota `POST /transactions/balance-adjustments` no `TransactionsController` e registrar no `TransactionsModule`
- [x] 8. Escrever testes unitários (use case, DTO com `ValidationPipe`, e `AppExceptionFilter`)
- [x] 9. Atualizar documentação viva (`docs/transactions/flows/balance-adjustment.md`, `docs/transactions/README.md`, `docs/integrations/transactions/create-balance-adjustment.md`, `docs/integrations/transactions/README.md`, `docs/integrations/errors.md`)
- [x] 10. Executar validações (`typecheck`, `lint:check`, `test`, `test:e2e`, `build`) e revisar diff
