---
area: accounts
feature: balance-summary
type: spec-tasks
status: current
related:
  - ./requirements.md
  - ./design.md
  - ./decisions.md
---

# Tasks - Account Balance Summary

## Spec

- [x] 1. Revisar e aprovar `requirements.md`.
- [x] 2. Revisar e aprovar `design.md`.
- [x] 3. Revisar e aprovar esta lista de tasks.

## Implementação

- [x] 4. Criar tipos internos de balance summary no módulo accounts.
- [x] 5. Criar migration de `initial_balance` para `initial_balance_cents`.
- [x] 6. Atualizar domínio/DTOs/mappers/cache de accounts para `initialBalanceCents`.
- [x] 7. Criar contrato `IAccountBalanceRepository`.
- [x] 8. Criar implementação TypeORM de agregação de saldo em lote.
- [x] 9. Atualizar `ListAccountsUseCase` para retornar accounts com balance.
- [x] 10. Atualizar DTO de use case de listagem para aceitar `projectedUntil`.
- [x] 11. Atualizar `ListAccountsQueryDto` com `projectedUntil` date-only.
- [x] 12. Atualizar `AccountResponseDto` para incluir `balance`.
- [x] 13. Atualizar `AccountsController.list` para repassar `projectedUntil`.
- [x] 14. Registrar providers necessários em `AccountsModule`.

## Validação

- [x] 15. Testar account sem transactions.
- [x] 16. Testar saldo atual com `INCOME` efetiva.
- [x] 17. Testar saldo atual com `EXPENSE` efetiva.
- [x] 18. Testar saldo atual com `TRANSFER` como origem e destino.
- [x] 19. Testar saldo atual com `ADJUSTMENT` increase/decrease.
- [x] 20. Testar que `PENDING` não altera `currentCents`.
- [x] 21. Testar `projectedCents` com pendência até `projectedUntil`.
- [x] 22. Testar que pendência depois de `projectedUntil` não entra na projeção.
- [x] 23. Testar que transaction deletada não entra no cálculo.
- [x] 24. Rodar `npm run build`.
- [x] 25. Rodar testes relevantes.
- [x] 26. Testar manualmente `GET /accounts` e `GET /accounts?projectedUntil=YYYY-MM-DD`.

## Documentação

- [x] 27. Atualizar `docs/accounts/concepts/account-balance.md`.
- [x] 28. Atualizar `docs/accounts/decisions/account-balance-is-derived.md`.
- [x] 29. Atualizar `docs/integrations/accounts/list-accounts.md`.
- [x] 30. Atualizar `docs/database/schema.md`.
- [x] 31. Atualizar Swagger de `GET /accounts`.
- [x] 32. Registrar decisões novas em `decisions.md` se surgirem durante a implementação.
