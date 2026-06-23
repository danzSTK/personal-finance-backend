---
area: accounts
type: flow
status: current
endpoint: PATCH /accounts/:id/archive
related:
  - ../concepts/default-account.md
  - ../concepts/archived-account.md
  - ../../integrations/accounts/archive-account.md
---

# Archive Account

Arquiva uma account preservando seu histórico.

## Fluxo Atual

1. Busca account por `accountId + userId`.
2. Se não existir, retorna `404`.
3. Se for default, retorna conflito.
4. Se houver transações futuras agendadas, retorna conflito.
5. Verifica se existe outra account ativa.
6. Se não existir outra account ativa, retorna conflito.
7. Marca account como arquivada.
8. Salva a alteração.

## Regra Planejada

`CASH` não poderá ser arquivada.
