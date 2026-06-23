---
area: transactions
type: reference
status: draft
related:
  - ../concepts/transaction.md
  - ../concepts/transaction-type.md
  - ../concepts/transaction-status.md
  - ../concepts/transaction-amount.md
---

# Invariants

## Planejadas

- Toda transaction pertence a um `userId`.
- `userId` vem da sessão autenticada e nunca do body.
- Toda transaction deve usar `amount > 0`.
- Toda transaction deve referenciar uma account do mesmo usuário.
- Toda transaction deve referenciar uma category do mesmo usuário.
- Transactions pendentes não afetam saldo atual.
- Transactions efetivadas afetam o histórico financeiro real.
- Transferências entre accounts próprias são neutras para resultado financeiro.
- Ajustes de saldo são transactions técnicas.
- Category arquivada não deve ser usada em novas transactions manuais.

## A Validar

- Enum final de status.
- Enum final de type.
- Se `date` será suficiente na V0.
- Como representar direção de adjustment mantendo `amount > 0`.
- Diferença final entre archive, deactivate e delete.
- Se transferência será uma transaction composta ou duas linhas vinculadas.
