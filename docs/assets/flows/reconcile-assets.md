---
area: assets
type: flow
status: current
related:
  - ../concepts/asset-status.md
  - ../decisions/asynchronous-deletion-via-reconciler.md
  - ./delete-asset.md
---

# Reconcile Assets

O serviço `AssetReconcilerService` no Worker corrige divergências de ciclo de vida e garante a desalocação física de objetos entre o PostgreSQL e o Cloudflare R2.

Ele consome o índice parcial:

```sql
CREATE INDEX "idx_assets_status_updated_at"
ON "assets" ("status", "updated_at")
WHERE "status" IN ('PENDING_UPLOAD', 'DELETE_PENDING', 'FAILED');
```

---

## 1. Desalocação de `DELETE_PENDING`

A cada ciclo de 60 segundos (configurável via `ASSET_RECONCILER_INTERVAL_MS`), o serviço executa:

1. **Seleção com Lock:**
   ```sql
   SELECT id, bucket, storage_key, metadata, status, updated_at
   FROM assets
   WHERE status = 'DELETE_PENDING'
     AND updated_at < NOW() - INTERVAL '30 seconds'
     AND (metadata->>'quarantine' IS NULL OR metadata->>'quarantine' = 'false')
   ORDER BY updated_at ASC
   LIMIT 50
   FOR UPDATE SKIP LOCKED;
   ```
2. **Exclusão Física:** Para cada asset, invoca `objectStorage.deleteObject({ bucket, key })`.
3. **Transição:** Em caso de sucesso ou objeto ausente (`NotFound`), executa `asset.markDeleted()` e persiste `status = 'DELETED'` com `deleted_at = now()`.
4. **Tratamento de Erros:**
   - Erros de rede ou do provedor incrementam `metadata.delete_attempts` e atualizam `updated_at = now()`.
   - Se `delete_attempts >= 5`, marca `metadata.quarantine = true` e emite log estruturado de erro crítico (`[ASSET_DELETE_QUARANTINED]`).

---

## 2. Limpeza de Uploads Abandonados (`PENDING_UPLOAD`)

Em varredura secundária, assets criados em `PENDING_UPLOAD` há mais de 2 horas (sem conclusão de upload):

1. São transicionados para `FAILED` com `failure_code = 'UPLOAD_TIMEOUT'`.
2. Liberam contagens lógicas de cotas e limites de uploads concorrentes.
