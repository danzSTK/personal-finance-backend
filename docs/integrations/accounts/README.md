---
area: accounts
type: integration
status: current
---

# Accounts Integration

Este diretório descreve como o frontend deve consumir o módulo HTTP de accounts.

Para regras de negócio, decisões e desenho arquitetural, use [Accounts architecture](../../accounts/README.md).

## Autenticação

Todas as rotas exigem sessão autenticada por cookies HttpOnly. Use `credentials: 'include'` no `fetch` ou `withCredentials: true` no `axios`.

O `userId` sempre vem da sessão autenticada. Clientes não devem enviar `userId` no body.

## Fluxo Para O Frontend

Depois de `sign-up` ou primeiro login OAuth, o backend cria uma account `CASH` default para o usuário por evento/outbox. Esse provisionamento pode ter um pequeno delay.

Fluxo recomendado no app:

1. Autenticar o usuário.
2. Chamar `GET /accounts`.
3. Se a lista ainda vier vazia para usuário recém-criado, manter estado de carregamento e tentar novamente em alguns instantes.
4. Só liberar fluxos financeiros que dependem de account depois que existir pelo menos uma account ativa.

Detalhes: [Default CASH provisioning](./default-cash-provisioning.md).

## Endpoints

- [Default CASH provisioning](./default-cash-provisioning.md)
- [Create account](./create-account.md)
- [List accounts](./list-accounts.md)
- [Update account](./update-account.md)
- [Archive account](./archive-account.md)
- [Unarchive account](./unarchive-account.md)
- [Set default account](./set-default-account.md)

## Modelo de resposta

```json
{
  "id": "5f6b18c6-1fd9-4e8f-99a8-4a7b65ef56e2",
  "name": "Nubank",
  "type": "BANK",
  "initialBalance": 1000,
  "color": "blue",
  "icon": "landmark",
  "includeInTotal": true,
  "isArchived": false,
  "isDefault": true,
  "createdAt": "2026-05-02T20:00:00.000Z",
  "updatedAt": "2026-05-02T20:00:00.000Z"
}
```

O response não expõe `userId`; o vínculo com usuário vem da sessão autenticada.

`color` e `icon` são tokens oficiais do produto. Use o catálogo exposto em `GET /categories/metadata` para montar seletores e renderizar fallback visual quando necessário.

## Tipos

- `CASH`
- `BANK`
- `CREDIT_CARD`
- `INVESTMENT`

Contrato do frontend na V0:

- `CASH` é criada automaticamente pelo backend no onboarding/provisionamento.
- O frontend não deve criar `CASH` por `POST /accounts`.
- Contas criadas pelo usuário devem usar `BANK`, `CREDIT_CARD` ou `INVESTMENT`.
- A experiência inicial da V0 deve focar em `CASH` e `BANK`.

## Atualização De Estado No Frontend

Após qualquer mutation (`POST`, `PATCH`, archive, unarchive, default), recarregue `GET /accounts` ou atualize o cache local com o response quando houver body.

Endpoints `204` não retornam body; nesses casos, recarregue a lista.
