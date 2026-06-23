---
area: accounts
type: integration
status: current
source: user.created outbox event
---

# Default CASH Provisioning

Quando um usuário novo é criado, o backend registra um evento `user.created` na outbox. O processor da outbox publica esse evento e o módulo de accounts cria uma account `CASH` default para o usuário.

Esse fluxo vale para:

- cadastro por email/senha;
- primeiro acesso por OAuth quando o usuário ainda não existia.

## Comportamento Para O Frontend

O frontend não chama endpoint específico para criar a account inicial. Após autenticar um usuário novo, chame:

```http
GET /accounts
```

Se a lista ainda estiver vazia, mostre um estado de carregamento curto e tente novamente. O provisionamento roda de forma assíncrona via outbox, então pode haver um pequeno delay entre criação do usuário e disponibilidade da account.

## Account Criada

```json
{
  "name": "Carteira",
  "type": "CASH",
  "initialBalance": 0,
  "color": null,
  "icon": null,
  "includeInTotal": true,
  "isArchived": false,
  "isDefault": true
}
```

O backend garante no banco no máximo uma account `CASH` por usuário.

## Regras De UI

- Não renderize ação de criar `CASH` manualmente.
- Não renderize ação de arquivar `CASH`.
- Não renderize ação de deletar `CASH`.
- Permita editar apenas dados visuais/exibição quando a conta for `CASH`: `name`, `color`, `icon` e `includeInTotal`.
- Para fluxos financeiros que exigem account, aguarde existir pelo menos uma account ativa.

## Erros Esperados

Esse fluxo não tem endpoint direto. Falhas de provisionamento devem ser tratadas pelo backend via retry da outbox. Para o frontend, o sintoma esperado é a lista de accounts ainda estar vazia por alguns instantes após o onboarding.
