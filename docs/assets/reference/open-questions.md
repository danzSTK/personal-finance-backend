---
area: assets
type: reference
status: open
---

# Assets Open Questions

- Manter `CHK_assets_checksum` fixo em SHA-256 ou registrar também o algoritmo?
- Por quanto tempo linhas `DELETED` serão retidas antes de eventual expurgo histórico?
- Como detectar objetos existentes no R2 sem linha no banco sem listar namespaces excessivamente grandes?
- Repository de assets terá cache? A tendência inicial é não, pois seus estados operacionais exigem leitura consistente.

## Dívida Técnica Registrada

- **Lease explícito no Reconciliador para múltiplos Workers:** Atualmente o claim de `findPendingDeletionBefore` e `findStalePendingUploadsBefore` usa `updated_at = now()` apoiado no grace period de 30s como lease implícito do lote. Para escalar horizontalmente para 2+ containers de Worker sem risco de reprocessamento concorrente em lotes que demorem mais de 30s no R2, deve-se evoluir para o modelo de `outbox_messages` (`locked_by`, `locked_until` e renovação periódica de lease).
