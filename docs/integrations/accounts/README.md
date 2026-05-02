---
area: accounts
type: integration
status: current
---

# Accounts Integration

Este diretório descreve o consumo HTTP das rotas de accounts.

Para regras de negócio, decisões e desenho arquitetural, use [Accounts architecture](../../accounts/README.md).

## Autenticação

Todas as rotas exigem sessão autenticada por cookies HttpOnly. Use `credentials: 'include'` no `fetch` ou `withCredentials: true` no `axios`.

O `userId` sempre vem da sessão autenticada. Clientes não devem enviar `userId` no body.

## Endpoints

- [Create account](./create-account.md)
- [List accounts](./list-accounts.md)
- [Update account](./update-account.md)
- [Archive account](./archive-account.md)
- [Unarchive account](./unarchive-account.md)
- [Set default account](./set-default-account.md)

## Modelo de resposta

```json
{
  "id": "acc_123",
  "userId": "user_123",
  "name": "Conta principal",
  "type": "BANK",
  "initialBalance": 1000,
  "color": "#2563eb",
  "icon": "landmark",
  "includeInTotal": true,
  "isArchived": false,
  "archivedAt": null,
  "isDefault": true,
  "createdAt": "2026-05-02T20:00:00.000Z",
  "updatedAt": "2026-05-02T20:00:00.000Z"
}
```

## Tipos aceitos

- `CASH`
- `BANK`
- `CREDIT_CARD`
- `INVESTMENT`

Na V0, o produto deve trabalhar principalmente com `CASH` e `BANK`. A regra planejada é que `CASH` seja criada pelo onboarding e não por criação manual.
