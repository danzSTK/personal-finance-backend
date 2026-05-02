---
area: accounts
type: flow
status: current
endpoint: PATCH /accounts/:id/default
related:
  - ../concepts/default-account.md
  - ../../integrations/accounts/set-default-account.md
---

# Set Default Account

Define a account padrão do usuário.

## Fluxo Atual

1. Busca account por `accountId + userId`.
2. Se não existir, retorna `404`.
3. Se estiver arquivada, retorna conflito.
4. Se já for default, retorna conflito.
5. Remove default atual do usuário.
6. Marca a account como default.
7. Salva a alteração.
