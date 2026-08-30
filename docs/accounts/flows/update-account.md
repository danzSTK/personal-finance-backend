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
7. Rejeita `template` combinado com `color`/`icon` legados.
8. Confirma uma referência institucional ou cria/atualiza o template customizado por regra do backend.
9. Aplica apenas campos definidos e mantém o dual-write legado.
10. Salva os aggregates na mesma transação e retorna a account atualizada.

## Campos Comuns

- `name`
- `type`
- `template`
- `color` e `icon` somente durante `DB-COMPAT-002`
- `includeInTotal`

## Regras Planejadas

- `CASH` só poderá alterar nome, cor, ícone e `includeInTotal`.
- `initialBalanceCents` deve ser editável apenas enquanto não existir movimentação.
