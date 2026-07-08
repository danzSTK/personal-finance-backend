---
area: accounts
feature: account-summary
type: spec-tasks
status: current
related:
  - ./requirements.md
  - ./design.md
  - ./decisions.md
---

# Tasks - Account Summary

## Spec

- [x] 1. Revisar e aprovar `requirements.md`.
- [x] 2. Revisar e aprovar `design.md`.
- [x] 3. Revisar e aprovar esta lista de tasks.

## Implementação - Accounts

- [x] 4. Adicionar `ACCOUNT_SUMMARY` em `RESPONSE_OBJECT_TYPES`.
- [x] 5. Adicionar tipos `AccountSummary` e `GetAccountSummaryInput` em `account-balance.repository.interface.ts`.
- [x] 6. Adicionar `getUserSummary` em `IAccountBalanceRepository`.
- [x] 7. Implementar query agregada em `AccountBalanceRepository.getUserSummary`.
- [x] 8. Criar `get-account-summary.dto.ts`.
- [x] 9. Criar `GetAccountSummaryUseCase`.
- [x] 10. Criar `get-account-summary.query.dto.ts`.
- [x] 11. Criar `account-summary.response.dto.ts`.
- [x] 12. Adicionar `GET /accounts/summary` em `AccountsController`.
- [x] 13. Registrar `GetAccountSummaryUseCase` em `AccountsModule`.

## Implementação - Transactions

- [x] 14. Remover `currentBalanceCents` de `TransactionGroupedSummary`.
- [x] 15. Remover `currentBalanceCents` dos DTOs de use case de list transactions.
- [x] 16. Remover `currentBalanceCents` de `ListTransactionsGroupedSummaryDto`.
- [x] 17. Remover `getCurrentBalanceCents` de `TransactionRepository`.
- [x] 18. Atualizar `getGroupedSummary` para retornar somente `income`, `expense` e `balance`.
- [x] 19. Ajustar testes existentes que esperam `currentBalanceCents`.

## Validação

- [x] 20. Testar `GetAccountSummaryUseCase` sem projeção.
- [x] 21. Testar `GetAccountSummaryUseCase` com projeção.
- [ ] 22. Testar saldo agregado sem transactions.
- [ ] 23. Testar saldo agregado com `INCOME` efetiva.
- [ ] 24. Testar saldo agregado com `EXPENSE` efetiva.
- [ ] 25. Testar saldo agregado com `TRANSFER` entre accounts selecionadas.
- [ ] 26. Testar saldo agregado com `TRANSFER` entre account selecionada e account excluída por filtro.
- [ ] 27. Testar saldo agregado com `ADJUSTMENT` increase/decrease.
- [ ] 28. Testar que `PENDING` não altera `currentCents`.
- [ ] 29. Testar que `PENDING` entra em `projectedCents` até `projectedUntil`.
- [ ] 30. Testar que transaction deletada não entra no cálculo.
- [ ] 31. Testar default excluindo accounts arquivadas.
- [ ] 32. Testar `includeArchived=true`.
- [ ] 33. Testar default excluindo accounts com `includeInTotal=false`.
- [ ] 34. Testar `includeExcludedFromTotal=true`.
- [ ] 35. Testar `includeArchived=true` combinado com `includeExcludedFromTotal=true`.
- [x] 36. Testar `GET /transactions` sem `type` sem `currentBalanceCents`.
- [x] 37. Testar `ListTransactionsResponseDto` sem `currentBalanceCents`.
- [x] 38. Rodar testes relevantes.
- [x] 39. Rodar `npm run build`.

## Documentação

- [x] 40. Criar `docs/integrations/accounts/get-account-summary.md`.
- [x] 41. Atualizar `docs/integrations/accounts/README.md`.
- [x] 42. Atualizar `docs/integrations/transactions/list-transactions.md`.
- [x] 43. Atualizar specs de `transactions/list-filters-summary` para remover `currentBalanceCents`.
- [x] 44. Atualizar Swagger de `GET /accounts/summary`.
- [x] 45. Atualizar Swagger de `GET /transactions`.
- [x] 46. Registrar novas decisões em `decisions.md` se surgirem durante a implementação.

## Verificação Manual

- [ ] 47. Testar manualmente `GET /accounts/summary`.
- [ ] 48. Testar manualmente `GET /accounts/summary?projectedUntil=YYYY-MM-DD`.
- [ ] 49. Testar manualmente os filtros `includeArchived` e `includeExcludedFromTotal`.
- [ ] 50. Testar manualmente `GET /transactions` sem `type` e confirmar ausência de `currentBalanceCents`.
