---
area: transactions
type: flow
status: draft
endpoint: PATCH /transactions/:id/confirm
related:
  - ../concepts/transaction-status.md
  - ../concepts/transaction-date.md
  - ../decisions/pending-transactions-do-not-affect-current-balance.md
---

# Confirm Pending Transaction

Confirma uma transaction pendente como realizada.

## Fluxo Planejado

1. Controller recebe o identificador da transaction.
2. `userId` vem de `@CurrentUser()`.
3. Use case busca a transaction por `id` e `userId`.
4. Use case valida se a transaction está pendente.
5. Entidade altera o status para efetivada.
6. Entidade registra a data/momento de confirmação se esse campo existir na modelagem final.
7. Repositório persiste o novo estado.
8. Controller retorna a transaction atualizada.

## Observação

A confirmação é o ponto em que uma pendência passa a afetar o saldo atual.
