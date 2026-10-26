---
area: assets
type: flow
status: current
related:
  - ../concepts/asset-status.md
  - ../decisions/retain-deleted-asset-records.md
  - ../decisions/asynchronous-deletion-via-reconciler.md
  - ./reconcile-assets.md
---

# Delete Asset

Remove um objeto que deixou de ser referenciado na aplicação.

## 1. Fluxo Canônico Desacoplado (Padrão Geral)

Este é o padrão canônico para remoção de assets na Danfy:

1. **Ação de Negócio (API):** O módulo consumidor (ex.: `transactions`, `users`) abre uma transação PostgreSQL, desvincula a referência e atualiza o asset para `DELETE_PENDING`.
2. **Efeito Imediato:** O asset deixa de ser retornado nas consultas normais da aplicação (que filtram `status = 'READY'`).
3. **Desalocação Física (Worker):** O `AssetReconcilerService` varre os registros em `DELETE_PENDING` que já ultrapassaram o grace period (30s).
4. **Chamada ao Storage:** Executa `IObjectStorage.deleteObject({ bucket, key })` no Cloudflare R2 de forma idempotente (se o objeto já não existir, trata como sucesso).
5. **Conclusão de Ciclo:** O asset avança para `DELETED`, recebendo `deleted_at = now()`.

Se a chamada ao R2 falhar por erro de rede ou 5xx, o asset permanece em `DELETE_PENDING` e o contador `metadata.delete_attempts` é incrementado para nova tentativa no próximo ciclo. Ao atingir o teto de 5 tentativas, o asset é colocado em quarentena (`metadata.quarantine = true`).

---

## 2. Fluxo Legado / Fast-Path (Avatar de Usuário)

No módulo de `users`, a substituição e remoção explícita de avatar ainda emitem eventos de domínio na Transactional Outbox (`UserAvatarUpdatedEvent` / `UserAvatarRemovedEvent`):

1. O handler no Worker escuta o evento e aciona `DeleteAvatarAssetUseCase`.
2. O use case marca `DELETE_PENDING`, chama `deleteObject` e avança para `DELETED`.
3. Se o handler falhar, o `AssetReconcilerService` atua como rede de segurança (safety net), garantindo que o asset em `DELETE_PENDING` não fique órfão.
