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
- [x] 4. Adicionar suporte a `findByIdsAndUserIdForUpdate` em `IAccountRepository` / `AccountRepository` / `CachedAccountRepository`, suporte a `options?: IRepositoryOptions` em `IAccountBalanceRepository` / `AccountBalanceRepository`, e criar/exportar as portas públicas `AccountBalanceQueryPort` e `AccountBalanceLockPort` em `AccountsCoreModule` (mantendo `IAccountBalanceRepository` privado)
- [x] 5. Propagar `options?: IRepositoryOptions` em `TransactionReferenceValidator.validate` para leituras transacionais consistentes
- [x] 6. Implementar `CreateBalanceAdjustmentUseCase` e seus DTOs de aplicação
- [x] 7. Implementar `CreateBalanceAdjustmentDto`, rota `POST /transactions/balance-adjustments` no `TransactionsController` e registrar no `TransactionsModule`
- [x] 8. Serializar `CreateTransactionUseCase`, `UpdateTransactionUseCase`, `ConfirmTransactionUseCase` e `DeleteTransactionUseCase` com `AccountBalanceLockPort` na mesma transação SQL
- [x] 9. Escrever/atualizar testes unitários (use cases de mutação, adaptadores de portas, `TransactionReferenceValidator`, DTO com `ValidationPipe`, e `AppExceptionFilter`)
- [x] 10. Atualizar documentação viva (`docs/transactions/flows/balance-adjustment.md`, `docs/transactions/README.md`, `docs/integrations/transactions/create-balance-adjustment.md`, `docs/integrations/transactions/README.md`, `docs/integrations/errors.md`) e spec
- [x] 11. Executar validações (`format:check`, `typecheck`, `lint:check`, `test`, `test:e2e`, `build`) e revisar diff
