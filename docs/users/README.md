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

## Avatar

A troca de avatar é um fluxo próprio porque coordena processamento de imagem, assets, Object Storage e outbox.

A implementação mantém `avatarAssetId` no domínio, registra eventos de atualização/remoção e usa lock pessimista para serializar alterações concorrentes.

Na leitura do perfil, `GET /users/me` resolve o asset atual para `avatarUrl` pública somente quando ele está `READY`.

Fluxo: [Update user avatar](./flows/update-user-avatar.md).

Remoção: [Remove user avatar](./flows/remove-user-avatar.md).

Roteiro técnico: [Implement update user avatar](./guides/implement-update-user-avatar.md).

Pendências: [Avatar pending work](./reference/avatar-pending.md).

## Fluxos Separados

`username` não faz parte do update genérico porque exige normalização, consulta de disponibilidade, unicidade e tratamento de concorrência.

`email` também fica separado porque interfere em autenticação, confirmação de endereço, providers vinculados e segurança de sessão.

Integração HTTP: [Users integration](../integrations/users/README.md).
