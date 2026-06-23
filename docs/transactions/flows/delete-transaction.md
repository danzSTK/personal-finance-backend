---
area: transactions
type: flow
status: draft
endpoint: DELETE /transactions/:id
related:
  - ../concepts/transaction.md
  - ../reference/invariants.md
---

# Delete Transaction

Remove uma transaction quando a regra de produto permitir.

## Fluxo Planejado

1. Controller recebe o identificador da transaction.
2. `userId` vem de `@CurrentUser()`.
3. Use case busca a transaction por `id` e `userId`.
4. Use case valida se delete físico é permitido.
5. Repositório remove ou inativa conforme a decisão final.
6. Controller retorna `204`.

## Decisão Pendente

Ainda falta decidir se transactions terão delete físico, archive/inactivation ou ambos.

Para preservar histórico financeiro, a tendência é usar inativação como comportamento padrão e permitir delete físico apenas para erros recentes sem vínculos relevantes.
