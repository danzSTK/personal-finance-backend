# Módulo Users — Instruções Locais

Este módulo é responsável pelo perfil do usuário, preferências cadastrais e pelo vínculo lógico do avatar do usuário com o módulo de assets.

## Documentação Obrigatória
Antes de planejar ou alterar código neste módulo, leia:
- `docs/specs/` de usuários e cadastro.
- `docs/assets/README.md` e `docs/assets/flows/delete-asset.md` — Regras de vínculo com `avatar_asset_id`.
- `docs/architecture/module-boundaries.md` — Limites e dívida técnica documentada.

## Regras de Domínio e Invariantes
- **Vínculo com Avatar:** O agregado `User` guarda apenas a referência lógica `avatar_asset_id`. Ao atualizar ou remover o avatar, emite eventos de domínio (`UserAvatarUpdatedEvent` / `UserAvatarRemovedEvent`) gravados na Transactional Outbox na mesma transação PostgreSQL.
- **Isolamento de Storage:** O módulo de usuários não deve acoplar lógica direta de exclusão física no Cloudflare R2; isso é delegado aos handlers de outbox e ao reconciliador de assets.
- **Validação de Perfil:** Dados cadastrais (nome, preferências) seguem as regras encapsuladas no domínio de `User` com normalização de strings e validação de limites de tamanho.
