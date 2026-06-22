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

A base de domínio já existe: `User` mantém `avatarAssetId`, registra `UserAvatarUpdatedEvent` ao trocar a referência e o repository oferece leitura com lock pessimista. Upload, endpoint e consumidor de limpeza ainda estão planejados.

Fluxo: [Update user avatar](./flows/update-user-avatar.md).

## Fluxos Separados

`username` não faz parte do update genérico porque exige normalização, consulta de disponibilidade, unicidade e tratamento de concorrência.

`email` também fica separado porque interfere em autenticação, confirmação de endereço, providers vinculados e segurança de sessão.

Integração HTTP: [Users integration](../integrations/users/README.md).
