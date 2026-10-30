---
area: transactions
feature: transaction-attachments
type: spec-design
status: approved
issue: 131
related:
  - ./requirements.md
  - ./tasks.md
  - ./decisions.md
  - ../../../../transactions/README.md
  - ../../../../assets/README.md
  - ../../../../storage/README.md
  - ../../../../architecture/module-boundaries.md
  - ../../../../database/schema.md
---

# Design — Transaction Attachments

## 1. Arquitetura e Camadas Envolvidas

```text
api/src/
├── shared/
│   └── object-storage/
│       ├── contracts/
│       │   └── object-storage.interface.ts # buildSignedReadUrl, getObject
│       └── adapters/
│           └── s3-object-storage.adapter.ts # Implementação com S3RequestPresigner
├── modules/
│   ├── assets/
│   │   ├── domain/enums/asset-purpose.enum.ts # TRANSACTION_ATTACHMENT
│   │   └── domain/factories/asset-storage-key.factory.ts # users/{userId}/transaction-attachments/{assetId}
│   └── transactions/
│       ├── domain/
│       │   ├── entities/
│       │   │   ├── transaction-attachment.entity.ts # Entidade de domínio do anexo
│       │   │   └── transaction.entity.ts # attachmentsCount e validação de tipo
│       │   └── repositories/
│       │       └── transaction-attachment.repository.interface.ts
│       ├── infrastructure/
│       │   ├── persistence/
│       │   │   ├── transaction-attachment-orm.entity.ts # Mapeamento TypeORM
│       │   │   └── transaction-attachment.repository.ts
│       │   ├── queues/
│       │   │   ├── transaction-attachment-optimization.processor.ts # Worker Sharp WebP
│       │   │   └── transaction-attachment-job-queue-producer.port.ts
│       │   └── image-processing/
│       │       └── transaction-attachment-image.validator.ts # Magic bytes + 60 MP
│       ├── application/
│       │   └── use-cases/
│       │       ├── add-transaction-attachments/
│       │       ├── list-transaction-attachments/
│       │       ├── delete-transaction-attachment/
│       │       └── reorder-transaction-attachments/
│       └── presentation/
│           ├── http/
│           │   ├── transactions.controller.ts # GET /:id com attachmentsCount
│           │   └── transaction-attachments.controller.ts # /transactions/:id/attachments
│           └── dto/
└── database/migrations/
    └── <timestamp>-AddTransactionAttachmentsAndExpandAssetPurpose.ts
```

---

## 2. Object Storage: Presigned URLs e Bucket Privado

### 2.1. Contrato da Porta `IObjectStorage`
```typescript
export interface SignedUrlOptions {
  expiresInSeconds?: number; // Padrão: 300 (5 min)
}

export interface SignedUrlOutput {
  url: string;
  expiresAt: Date;
  cacheMaxAgeSeconds: number; // 240 (4 min)
}

export abstract class IObjectStorage {
  // Já existente:
  abstract buildPublicUrl(location: ObjectLocation): string;

  // Novos métodos:
  abstract buildSignedReadUrl(location: ObjectLocation, options?: SignedUrlOptions): Promise<SignedUrlOutput>;
  abstract getObject(location: ObjectLocation): Promise<{ body: Buffer; contentType: string | null }>;
}
```

### 2.2. Implementação com `@aws-sdk/s3-request-presigner`
- `buildSignedReadUrl(location)`:
  - Valida rigorosamente `location.bucket === config.privateBucketName`. Se for público ou outro, lança erro `PRIVATE_URL_UNAVAILABLE`.
  - Instancia `GetObjectCommand({ Bucket: location.bucket, Key: location.key })`.
  - Gera URL com `getSignedUrl(this.client, command, { expiresIn: 300 })`.
  - Retorna a URL assinada, data de expiração (`now + 300s`) e `cacheMaxAgeSeconds = 240`.
- `getObject(location)`:
  - Executa `GetObjectCommand` e converte o stream de leitura do SDK em `Buffer`.
- `putObject(input)`:
  - Se `input.bucket === config.privateBucketName`, grava `CacheControl: 'private, max-age=300'`.
  - Se `input.bucket === config.publicBucketName`, grava `CacheControl: 'public, max-age=31536000, immutable'`.

---

## 3. Modelo de Dados e Migrations

### 3.1. DDL da Tabela `transaction_attachments`
```sql
CREATE TABLE "transaction_attachments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "transaction_id" uuid NOT NULL,
  "asset_id" uuid NOT NULL,
  "position" smallint NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_transaction_attachments" PRIMARY KEY ("id"),
  CONSTRAINT "FK_transaction_attachments_transaction"
    FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_transaction_attachments_asset"
    FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT,
  CONSTRAINT "UQ_transaction_attachments_transaction_asset"
    UNIQUE ("transaction_id", "asset_id"),
  CONSTRAINT "UQ_transaction_attachments_transaction_position"
    UNIQUE ("transaction_id", "position"),
  CONSTRAINT "CHK_transaction_attachments_position"
    CHECK ("position" >= 0 AND "position" <= 2)
);

CREATE INDEX "idx_transaction_attachments_transaction_position"
ON "transaction_attachments" ("transaction_id", "position");
```

### 3.2. Expansão de Purpose em `assets`
```sql
ALTER TABLE "assets" DROP CONSTRAINT "CHK_assets_purpose";
ALTER TABLE "assets" ADD CONSTRAINT "CHK_assets_purpose"
  CHECK ("purpose" IN ('USER_AVATAR', 'TRANSACTION_ATTACHMENT'));
```

---

## 4. Fluxo Transacional e Prevenção de Concorrência

### 4.1. Upload e Adição de Anexos
1. **Validação Síncrona Inicial:** Inspeciona magic bytes (`file-type`), valida tamanho `<= 5 MB` e teto de 60 MP (`sharp(bytes).metadata()`).
2. **Reserva Atômica (Transação Curta):**
   ```text
   BEGIN
     SELECT * FROM transactions WHERE id = :txId AND user_id = :userId FOR UPDATE;
     Valida type IN ('INCOME', 'EXPENSE')
     Valida activeCount + incomingCount <= 3
     Gera Asset PENDING_UPLOAD para cada item
     Gera TransactionAttachment com position calculada
     Persiste Assets e Attachments
   COMMIT
   ```
3. **Upload dos Originais (Fora do Lock):**
   - Para cada anexo, executa `objectStorage.putObject` no bucket privado com key `users/{userId}/transaction-attachments/{assetId}`.
4. **Confirmação Atômica (`markReady`):**
   ```text
   BEGIN
     SELECT * FROM transactions WHERE id = :txId FOR UPDATE;
     IF transaction.deleted_at IS NOT NULL:
       -- A transação foi deletada enquanto os bytes subiam!
       markFailed('TRANSACTION_DELETED') -> markDeletePending()
     ELSE:
       markReady() nos assets que subiram com sucesso
       enfileira jobs BullMQ de otimização
   COMMIT
   ```

### 4.2. Exclusão da Transação Pai (`DELETE /transactions/:id`)
```text
BEGIN
  SELECT * FROM transactions WHERE id = :id AND user_id = :userId FOR UPDATE;
  transaction.delete(); // deleted_at = now()
  SELECT asset_id FROM transaction_attachments WHERE transaction_id = :id;
  UPDATE assets SET status = 'DELETE_PENDING', updated_at = now()
    WHERE id IN (:assetIds) AND status IN ('READY', 'FAILED');
  SAVE transaction;
COMMIT
```

### 4.3. Job de Otimização no Worker (BullMQ)
1. Recebe `{ assetId, userId }`.
2. Busca o asset no banco.
3. Se `asset.status !== 'READY'`, **aborta** (evita sobrescrever asset deletado).
4. Baixa os bytes originais via `objectStorage.getObject`.
5. Processa no Sharp: `.rotate()`, strip metadata, `.resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })`, `.webp({ quality: 80 })`.
6. Sobrescreve no bucket privado na mesma key.
7. Abre transação curta no banco:
   - `SELECT status FROM assets WHERE id = :assetId FOR UPDATE`.
   - Se ainda estiver `READY`, atualiza `content_type = 'image/webp'`, `size_bytes`, `checksum` e metadata.
   - Se tiver virado `DELETE_PENDING` ou `DELETED`, aborta.

---

## 5. Contrato HTTP (Rotas e DTOs)

| Método | Rota | Descrição |
|:---|:---|:---|
| `GET` | `/transactions` | Retorna lista de transações com campo `attachmentsCount: number` |
| `GET` | `/transactions/:id` | Retorna detalhe da transação com campo `attachmentsCount: number` |
| `GET` | `/transactions/:id/attachments` | Retorna array da galeria com Presigned URLs, `expiresAt` e `cacheMaxAgeSeconds` |
| `POST` | `/transactions/:id/attachments` | Upload multipart (`files: 1 a 3`) de novos anexos |
| `DELETE` | `/transactions/:id/attachments/:attachmentId` | Exclui anexo individual e marca asset como `DELETE_PENDING` |
| `PATCH` | `/transactions/:id/attachments/positions` | Atualiza posições `{ positions: [{ id, position }] }` sob lock |
