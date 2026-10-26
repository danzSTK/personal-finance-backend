---
area: assets
feature: asset-reconciler
type: spec-design
status: approved
issue: 127
related:
  - ./requirements.md
  - ./tasks.md
  - ./decisions.md
  - ../../../../assets/README.md
  - ../../../../assets/flows/reconcile-assets.md
  - ../../../../database/schema.md
---

# Design — Asset Reconciler

## 1. Arquitetura e Camadas Envolvidas

O serviço de reconciliação reside no módulo `assets`, desacoplado de qualquer módulo financeiro ou de autenticação, e é executado exclusivamente no runtime do **Worker** (`api/src/app/worker/`).

```text
api/src/
├── config/
│   └── worker.config.ts                   # Variáveis de intervalo, batch size, grace period e retries
├── modules/assets/
│   ├── domain/
│   │   └── repositories/
│   │       └── asset.repository.interface.ts # Port: findPendingDeletionBefore, findStalePendingUploadsBefore
│   ├── infrastructure/
│   │   └── persistence/
│   │       └── asset.repository.ts        # TypeORM QueryBuilder com FOR UPDATE SKIP LOCKED
│   └── application/
│       └── services/
│           ├── asset-reconciler.service.ts # Orquestrador com setInterval e lifecycle hooks
│           └── asset-reconciler.service.spec.ts # Testes unitários do reconciliador
└── app/worker/
    └── worker.module.ts                   # Registro do AssetReconcilerService no container do Worker
```

---

## 2. Dependências e Portas

- `IAssetRepository`: Fornece os métodos de busca e persistência das transições de estado dos assets.
- `IObjectStorage`: Fornece o método `deleteObject({ bucket, key })` implementado pelo `S3ObjectStorageAdapter`.
- `ConfigType<typeof workerConfig>`: Injeta os parâmetros de timing e thresholds do worker.

---

## 3. Modelo de Dados e Persistência

### 3.1. Schema e Migrations
**Nenhuma nova migration é necessária.** O schema atual em `1778800000000-CreateAssets.ts` já suporta 100% dos requisitos:
- Colunas: `id`, `bucket`, `storage_key`, `status`, `metadata` (JSONB), `updated_at`, `deleted_at`.
- Índice parcial: `idx_assets_status_updated_at` sobre `("status", "updated_at") WHERE "status" IN ('PENDING_UPLOAD', 'DELETE_PENDING', 'FAILED')`.

### 3.2. Estrutura do `metadata` para Falhas e Quarentena
Em caso de falha no R2, o campo `metadata` recebe:
```json
{
  "delete_attempts": 1,
  "last_delete_error": "TimeoutError: Request timed out after 30000ms",
  "last_delete_attempt_at": "2026-10-26T20:00:00.000Z",
  "quarantine": false
}
```
Se `delete_attempts >= 5`:
```json
{
  "delete_attempts": 5,
  "last_delete_error": "S3Error: Access Denied",
  "last_delete_attempt_at": "2026-10-26T20:05:00.000Z",
  "quarantine": true
}
```

### 3.3. Queries SQL Otimizadas

#### Busca de `DELETE_PENDING`:
```sql
SELECT * FROM assets
WHERE status = 'DELETE_PENDING'
  AND updated_at < :cutoffDate
  AND (metadata->>'quarantine' IS NULL OR metadata->>'quarantine' = 'false')
ORDER BY updated_at ASC
LIMIT :batchSize
FOR UPDATE SKIP LOCKED;
```

#### Busca de `PENDING_UPLOAD` Abandonados:
```sql
SELECT * FROM assets
WHERE status = 'PENDING_UPLOAD'
  AND updated_at < :staleUploadCutoffDate
ORDER BY updated_at ASC
LIMIT :batchSize
FOR UPDATE SKIP LOCKED;
```

---

## 4. Orquestrador (`AssetReconcilerService`)

### 4.1. Lifecycle e Concorrência Interna
```typescript
@Injectable()
export class AssetReconcilerService implements OnModuleInit, BeforeApplicationShutdown {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isDraining = false;

  onModuleInit(): void {
    this.interval = setInterval(
      () => void this.reconcile(),
      this.config.assetReconciliation.intervalMs,
    );
    this.interval.unref();
  }

  beforeApplicationShutdown(): void {
    this.isDraining = true;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
```

### 4.2. Algoritmo de Execução do Ciclo (`reconcile()`)
1. Se `isRunning || isDraining`, aborta imediatamente.
2. Define `isRunning = true`.
3. Executa `reconcilePendingDeletions()`:
   - Calcula `cutoff = now() - gracePeriodMs` (30s).
   - Busca até `batchSize` assets.
   - Itera sequencialmente sobre cada asset:
     - Tenta `objectStorage.deleteObject({ bucket: asset.bucket, key: asset.storageKey })`.
     - Sucesso ou 404: `asset.markDeleted()`, reseta flags de erro em `metadata`, salva via repositório.
     - Falha (5xx/timeout): incrementa `metadata.delete_attempts`, atualiza `updated_at = now()`. Se atingir `maxRetries`, seta `metadata.quarantine = true` e emite log de erro crítico estruturado. Salva o asset.
4. Executa `reconcileStalePendingUploads()`:
   - Calcula `staleCutoff = now() - staleUploadMs` (2h).
   - Busca até `batchSize` assets em `PENDING_UPLOAD`.
   - Para cada um: `asset.markFailed('UPLOAD_TIMEOUT')`, salva no repositório.
5. Bloco `finally`: define `isRunning = false`.

---

## 5. Parâmetros em `worker.config.ts`

```typescript
assetReconciliation: {
  intervalMs: Number(process.env.ASSET_RECONCILER_INTERVAL_MS ?? 60000),
  batchSize: Number(process.env.ASSET_RECONCILER_BATCH_SIZE ?? 50),
  deleteGracePeriodMs: Number(process.env.ASSET_RECONCILER_DELETE_GRACE_PERIOD_MS ?? 30000),
  stalePendingUploadMs: Number(process.env.ASSET_RECONCILER_STALE_PENDING_MS ?? 7200000),
  maxRetries: Number(process.env.ASSET_RECONCILER_MAX_RETRIES ?? 5),
}
```

---

## 6. Estratégia de Testes

1. **Testes Unitários (`asset-reconciler.service.spec.ts`):**
   - Deve processar lote com sucesso, chamando `deleteObject` e `markDeleted`.
   - Deve tratar 404 (`NotFound`) no R2 como sucesso e marcar `DELETED`.
   - Deve capturar falha no R2, incrementar tentativas e não abortar outros itens do lote.
   - Deve marcar quarentena e emitir log `ERROR` ao atingir `maxRetries`.
   - Deve ignorar ciclo quando `isRunning` ou `isDraining` for verdadeiro.
   - Deve expirar `PENDING_UPLOAD` antigos para `FAILED` com `UPLOAD_TIMEOUT`.
2. **Testes de Repositório (`asset.repository.spec.ts`):**
   - Validar que `findPendingDeletionBefore` filtra `updated_at` e assets em quarentena.
   - Validar que `findStalePendingUploadsBefore` filtra corretamente por status e data de corte.
