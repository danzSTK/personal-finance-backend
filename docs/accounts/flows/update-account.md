---
area: accounts
type: flow
status: current
endpoint: PATCH /accounts/:id
related:
  - ../concepts/cash-account.md
  - ../concepts/account-balance.md
  - ../../integrations/accounts/update-account.md
---

# Update Account

Atualiza campos editáveis de uma account.

## Fluxo Atual

1. Controller recebe `UpdateAccountDto`.
2. `userId` vem de `@CurrentUser()`.
3. Use case busca account por `accountId + userId`.
4. Se não existir, retorna `404`.
5. Se estiver arquivada, retorna conflito.
6. Se não houver nenhum campo de patch, retorna conflito.
7. Aplica apenas campos definidos.
8. Salva e retorna a account atualizada.

## Campos Comuns

- `name`
- `type`
- `color`
- `icon`
- `includeInTotal`

## Regras Planejadas

- `CASH` só poderá alterar nome, cor, ícone e `includeInTotal`.
- `initialBalanceCents` deve ser editável apenas enquanto não existir movimentação.
