---
area: users
type: architecture
status: current
---

# Users

O módulo `users` mantém a identidade e os dados simples de perfil do usuário.

## Perfil Editável

O fluxo atual permite alterar:

- `firstName`;
- `lastName`.

Fluxo: [Update user profile](./flows/update-user-profile.md).

## Fluxos Separados

`username` não faz parte do update genérico porque exige normalização, consulta de disponibilidade, unicidade e tratamento de concorrência.

`email` também fica separado porque interfere em autenticação, confirmação de endereço, providers vinculados e segurança de sessão.

Integração HTTP: [Users integration](../integrations/users/README.md).
