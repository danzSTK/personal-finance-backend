---
area: users
type: reference
status: open
related:
  - ../flows/update-user-avatar.md
  - ../flows/remove-user-avatar.md
  - ../../assets/flows/reconcile-assets.md
---

# Avatar Pending Work

## Implementado

- `PUT /users/me/avatar`;
- `DELETE /users/me/avatar` idempotente;
- processamento JPEG/PNG/WebP para WebP `512x512`;
- persistência do ciclo de vida em `assets`;
- eventos `user.avatar.updated` e `user.avatar.removed` via outbox;
- remoção assíncrona e idempotente no Object Storage.

## Pendente

### Leitura Do Perfil

`GET /users/me` ainda precisa expor a URL pública do avatar atual. A projeção deve resolver `avatarAssetId` para um asset `READY` e montar a URL por `IObjectStorage`, sem expor bucket ou storage key.

### Reconciliação

Criar job para tratar:

- assets `PENDING_UPLOAD` antigos;
- assets `DELETE_PENDING` presos;
- assets `FAILED` elegíveis para limpeza;
- objetos órfãos existentes no R2 sem referência válida no PostgreSQL.

### Testes De Integração

Adicionar cenário E2E autenticado para upload, substituição e remoção. O teste precisa verificar banco, outbox e Object Storage sem depender apenas de mocks unitários.

### Operação

Adicionar métricas/alertas para mensagens de avatar em `FAILED` ou `DEAD`, falhas de compensação e crescimento de assets pendentes.
