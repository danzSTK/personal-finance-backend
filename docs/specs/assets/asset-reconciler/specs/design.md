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

O serviço de reconciliação reside no módulo `assets`, desacoplado de qualquer módulo financeiro ou de autenticação, e é executado exclusivamente no runtime do **Worker** (`api/src/app/worker/`) por meio de um `AssetsWorkerModule` dedicado.

```text
api/src/
├── common/models/constants/
│   └── asset.constants.ts                  # Constante centralizada ASSET_MAX_DELETE_ATTEMPTS = 5
├── config/
│   ├── config.module.ts                    # Validação Joi das variáveis ASSET_RECONCILER_*
│   └── worker.config.ts                    # Variáveis de intervalo, batch size, grace period e stale timeout
├── modules/assets/
│   ├── assets-worker.module.ts             # Módulo exclusivo do Worker (evita rodar poller na API)
│   ├── domain/
│   │   ├── enums/
│   │   │   └── asset-failure-code.enum.ts  # Enum AssetFailureCode (STORAGE_UPLOAD_FAILED, UPLOAD_TIMEOUT)
│   │   ├── entities/
│   │   │   └── asset.entity.ts             # Método recordDeleteFailure(errorMessage) usando ASSET_MAX_DELETE_ATTEMPTS
│   │   └── repositories/
│   │       └── asset.repository.interface.ts # Port: findPendingDeletionBefore, findStalePendingUploadsBefore
│   ├── infrastructure/
│   │   └── persistence/
│   │       └── asset.repository.ts         # Claim atômico com FOR UPDATE SKIP LOCKED
│   └── application/
│       └── services/
│           ├── asset-reconciler.service.ts # Orquestrador com setInterval e lifecycle hooks
│           └── asset-reconciler.service.spec.ts # Testes unitários do reconciliador
└── app/worker/
    └── worker.module.ts                    # Importa AssetsWorkerModule no container do Worker
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

### 3.3. Queries SQL e Isolamento Transacional (Sem I/O de Rede sob Lock)

Como o PostgreSQL exige transação ativa para `FOR UPDATE SKIP LOCKED` e chamadas HTTP ao Cloudflare R2 **nunca** devem ocorrer com uma transação de banco aberta:

#### 1. Claim de `DELETE_PENDING` (`findPendingDeletionBefore`):
Executa uma transação curta no banco (`assetRepository.manager.transaction`) que seleciona o lote com `FOR UPDATE SKIP LOCKED` e atualiza `updated_at = NOW()` antes de retornar as entidades mapeadas. Isso libera o lock imediatamente e garante que nenhum outro worker selecione os mesmos registros durante a janela de carência enquanto o R2 é chamado fora da transação:
```sql
SELECT * FROM assets
WHERE status = 'DELETE_PENDING'
  AND updated_at < :cutoffDate
  AND (metadata->>'quarantine' IS NULL OR metadata->>'quarantine' = 'false')
ORDER BY updated_at ASC
LIMIT :batchSize
FOR UPDATE SKIP LOCKED;
```

#### 2. Claim de `PENDING_UPLOAD` Abandonados (`findStalePendingUploadsBefore`):
Executa uma transação curta no banco com `FOR UPDATE SKIP LOCKED` e também atualiza `updated_at = NOW()` nos registros selecionados antes de encerrar a transação curta, impedindo que um segundo worker selecione o mesmo lote de uploads expirados após a liberação do lock:
```sql
SELECT * FROM assets
WHERE status = 'PENDING_UPLOAD'
  AND updated_at < :staleUploadCutoffDate
ORDER BY updated_at ASC
LIMIT :batchSize
FOR UPDATE SKIP LOCKED;
```

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
     - No `try`: chama `objectStorage.deleteObject({ bucket: asset.bucket, key: asset.storageKey })`, executa `asset.markDeleted()` (que preserva em memória os metadados anteriores em `previousMetadataBeforeDelete`) e salva `assetRepository.save(asset)`.
     - No `catch (error)`: tanto se falhar no R2 quanto se falhar ao persistir `DELETED` no banco, chama `asset.recordDeleteFailure(errorMessage)`. Se `markDeleted()` já havia sido chamado em memória antes do erro de banco, `recordDeleteFailure` reverte a entidade em memória para `DELETE_PENDING` (`deletedAt = null`), restaura `previousMetadataBeforeDelete`, incrementa `delete_attempts` até `ASSET_MAX_DELETE_ATTEMPTS` (`5`), aplica `quarantine = true` ao atingir o teto e persiste o retry/quarentena no banco, impedindo loops infinitos.
4. Executa `reconcileStalePendingUploads()`:
   - Calcula `staleCutoff = now() - staleUploadMs` (2h).
   - Busca até `batchSize` assets em `PENDING_UPLOAD`.
   - Para cada um: `asset.markFailed(AssetFailureCode.UPLOAD_TIMEOUT)`, salva no repositório.
5. Bloco `finally`: define `isRunning = false`.

---

## 5. Parâmetros em `worker.config.ts`

```typescript
assetReconciliation: {
  intervalMs: Number(process.env.ASSET_RECONCILER_INTERVAL_MS ?? 60000),
  batchSize: Number(process.env.ASSET_RECONCILER_BATCH_SIZE ?? 50),
  deleteGracePeriodMs: Number(process.env.ASSET_RECONCILER_DELETE_GRACE_PERIOD_MS ?? 30000),
  stalePendingUploadMs: Number(process.env.ASSET_RECONCILER_STALE_PENDING_MS ?? 7200000),
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
