---
area: transactions
feature: core
type: spec-tasks
status: current
related:
  - ./requirements.md
  - ./design.md
  - ./decisions.md
---

# Tasks - Transactions Core

## Preparação Já Feita

- [x] 1. Definir enums iniciais de transaction: type, status e direction.
- [x] 2. Criar migration inicial do schema de transactions com `amount_cents`, `type`, `status`, `effective_at`, `direction`, `destination_account_id` e `deleted_at`.
- [x] 3. Atualizar `docs/database/schema.md` com o schema atual esperado.

## Spec

- [x] 4. Revisar e aprovar `requirements.md`.
- [x] 5. Revisar e aprovar `design.md`.
- [x] 6. Revisar e aprovar esta lista de tasks.

## Implementação

- [x] 7. Criar `TransactionsModule`.
- [x] 8. Mover/reestruturar ORM entity de transactions para `api/src/modules/transactions/infrastructure/persistence/`.
- [x] 9. Atualizar `api/src/config/entities.ts` para usar o ORM entity modular.
- [x] 10. Criar entidade de domínio `Transaction`.
- [x] 11. Criar factory de domínio para criação/reconstituição de transactions.
- [x] 12. Criar erros de domínio e aplicação do módulo seguindo `platform-errors`.
- [x] 13. Criar interface `ITransactionRepository`.
- [x] 14. Criar `TransactionMapper`.
- [x] 15. Criar implementação TypeORM de `TransactionRepository`.
- [x] 16. Criar use case `create-transaction`.
- [x] 17. Criar use case `list-transactions`.
- [x] 18. Criar use case `get-transaction`.
- [x] 19. Criar use case `update-transaction`.
- [x] 20. Criar use case `confirm-transaction`.
- [x] 21. Criar use case `delete-transaction`.
- [x] 22. Criar DTOs de presentation para create, update, confirm e list filters.
- [x] 23. Criar response DTOs de transaction.
- [x] 24. Criar `TransactionsController` com rotas protegidas.
- [x] 25. Registrar providers e exports necessários no módulo.

## Validação

- [x] 26. Criar testes unitários da entidade/factory.
- [ ] 27. Criar testes de use case com repositories mockados.
- [x] 28. Testar manualmente criação/listagem/busca/update/confirm/delete no backend local.
  - [x] 28.1. Validar signup/onboarding, criação de CASH default, categories default e account BANK auxiliar.
  - [x] 28.2. Validar rotas de transactions sem depender de category técnica exposta ao frontend.
- [x] 29. Rodar `npm run build`.
- [x] 30. Rodar testes relevantes.

## Documentação

- [x] 31. Atualizar `docs/transactions/flows/create-transaction.md`.
- [x] 32. Atualizar `docs/transactions/flows/update-transaction.md`.
- [x] 33. Atualizar `docs/transactions/flows/confirm-pending-transaction.md`.
- [x] 34. Atualizar `docs/transactions/flows/delete-transaction.md`.
- [x] 35. Criar `docs/integrations/transactions/**` para o frontend.
- [x] 36. Atualizar Swagger dos endpoints.
- [x] 37. Registrar decisões novas em `decisions.md` se surgirem durante a implementação.
