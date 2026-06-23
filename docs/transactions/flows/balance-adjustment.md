---
area: transactions
type: flow
status: draft
related:
  - ../concepts/transaction-type.md
  - ../decisions/adjustments-are-technical-transactions.md
  - ../../accounts/concepts/account-balance.md
  - ../../categories/decisions/categories.md
---

# Balance Adjustment

Registra uma correção técnica de saldo por meio de transaction.

## Fluxo Planejado

1. Controller recebe a account, valor, direção e motivo do ajuste.
2. `userId` vem de `@CurrentUser()`.
3. Use case valida se a account pertence ao usuário.
4. Use case obtém a category técnica `ADJUSTMENT` do usuário.
5. Factory cria uma transaction técnica de ajuste.
6. Repositório persiste a transaction.
7. Controller retorna a transaction criada.

## Decisão Pendente

Ainda falta validar como representar a direção do ajuste mantendo `amount > 0`.

Opções possíveis:

- usar um campo de direction;
- usar transaction type específico para ajuste positivo e negativo;
- usar uma semântica interna baseada em categoria/tipo.
