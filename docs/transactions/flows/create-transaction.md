---
area: transactions
type: flow
status: draft
endpoint: POST /transactions
related:
  - ../concepts/transaction.md
  - ../reference/invariants.md
---

# Create Transaction

Cria uma transaction para o usuário autenticado.

## Fluxo Planejado

1. Controller recebe dados da transaction.
2. `userId` vem de `@CurrentUser()`.
3. Use case valida se account pertence ao usuário.
4. Use case valida se category pertence ao usuário.
5. Use case valida compatibilidade entre tipo da transaction e category.
6. Factory cria a entidade de domínio.
7. Repositório persiste a transaction.
8. Controller retorna a representação da transaction criada.

## Observação

Este fluxo ainda é rascunho. A forma final depende da validação de type, status, datas e impacto no saldo.
