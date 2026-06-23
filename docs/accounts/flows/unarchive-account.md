---
area: accounts
type: flow
status: current
endpoint: PATCH /accounts/:id/unarchive
related:
  - ../concepts/archived-account.md
  - ../../integrations/accounts/unarchive-account.md
---

# Unarchive Account

Restaura uma account arquivada.

## Fluxo Atual

1. Busca account por `accountId + userId`.
2. Se não existir, retorna `404`.
3. Se não estiver arquivada, retorna conflito.
4. Marca account como ativa.
5. Salva a alteração.
