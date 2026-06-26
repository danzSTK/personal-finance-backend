---
area: transactions
feature: list-filters-summary
type: spec-tasks
status: approved
related:
  - ./requirements.md
  - ./design.md
  - ./decisions.md
---

# Tasks - Transaction List Filters And Summary

## Spec

- [x] 1. Revisar e aprovar `requirements.md`.
- [x] 2. Revisar e aprovar `design.md`.
- [x] 3. Revisar e aprovar esta lista de tasks.

## Implementação

- [x] 4. Criar tipo/constante de sort permitido para listagem de transactions.
- [x] 5. Atualizar `ListTransactionsQueryDto` para aceitar e validar `sort`.
- [x] 6. Atualizar DTOs de use case para receber `sort` e retornar `summary`.
- [x] 7. Atualizar `ListTransactionsUseCase` para aplicar default `sort=date:desc` e repassar ao repository.
- [x] 8. Atualizar `ITransactionRepository.list` para retornar `summary`.
- [x] 9. Refatorar `TransactionRepository.list` para reutilizar aplicação de filtros entre listagem/count/summary.
- [x] 10. Implementar ordenação `date:asc` e `date:desc` com desempate por `id`.
- [x] 11. Implementar query agregada de `summary` usando centavos inteiros e regras por `type`, `status`, `direction` e `accountId`.
- [x] 12. Atualizar `ListTransactionsResponseDto` para expor `summary`.
- [x] 13. Atualizar `TransactionsController.list` para repassar `sort`.
- [x] 35. Alterar listagem sem `type` para restringir `INCOME` e `EXPENSE`.
- [x] 36. Alterar summary explícito por `type` para usar valores positivos.
- [x] 37. Implementar summary agrupado sem `type` com `income`, `expense` e `balance`.
- [x] 38. Calcular `currentBalanceCents` com e sem `accountId`.
- [x] 39. Atualizar response DTO para representar os dois shapes de summary.

## Validação

- [ ] 14. Testar validação de `sort` permitido e inválido.
- [ ] 15. Testar `dateFrom` e `dateTo` inclusivos como `DateOnly`.
- [ ] 16. Testar filtros combinados por `status`, `type`, `accountId` e `categoryId`.
- [x] 17. Testar `sort=date:asc`.
- [x] 18. Testar `sort=date:desc` e default sem `sort`.
- [ ] 19. Testar `summary` vazio retornando zeros.
- [ ] 20. Testar summary agrupado com `INCOME` e `EXPENSE`.
- [ ] 21. Testar summary simples positivo para `type=INCOME` e `type=EXPENSE`.
- [ ] 22. Testar `currentBalanceCents` e `expectedBalanceCents`.
- [ ] 23. Testar listagem sem `type` excluindo `TRANSFER` e `ADJUSTMENT`.
- [x] 24. Testar `summary.pendingCents`, `summary.effectiveCents` e `summary.totalCents`.
- [ ] 25. Testar que `summary` ignora `page` e `limit`.
- [ ] 26. Testar que transactions deletadas não aparecem nem entram no `summary`.
- [ ] 27. Testar isolamento por usuário.
- [x] 28. Rodar `npm run build`.
- [x] 29. Rodar testes relevantes.
- [ ] 30. Testar manualmente `GET /transactions` com filtros, sort e summary.
- [ ] 40. Testar manualmente o contrato sem `type`.
- [ ] 41. Testar manualmente o contrato com `type=INCOME` e `type=EXPENSE`.

## Documentação

- [x] 31. Atualizar Swagger de `GET /transactions` para `sort` e `summary`.
- [x] 32. Atualizar `docs/integrations/transactions/list-transactions.md` com query `sort`, response `summary` e regras de cálculo.
- [x] 33. Revisar `docs/integrations/transactions/README.md`; nenhuma alteração necessária.
- [x] 34. Registrar decisões novas em `decisions.md` se surgirem durante a implementação.
- [x] 44. Atualizar docs de integração para o contrato dinâmico de summary.
