---
area: transactions
type: flow
status: draft
endpoint: PATCH /transactions/:id
related:
  - ../concepts/transaction.md
  - ../reference/invariants.md
---

# Update Transaction

Atualiza uma transaction existente do usuário autenticado.

## Fluxo Planejado

1. Controller recebe o identificador da transaction e os dados editáveis.
2. `userId` vem de `@CurrentUser()`.
3. Use case busca a transaction por `id` e `userId`.
4. Use case valida se a transaction aceita alteração.
5. Use case valida novos vínculos de account e category quando forem enviados.
6. Entidade aplica as alterações permitidas.
7. Repositório persiste o novo estado.
8. Controller retorna a transaction atualizada.

## Observação

Campos editáveis e restrições ainda dependem da decisão final sobre status, transferência, ajuste e histórico financeiro.
