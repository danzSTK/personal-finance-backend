---
area: transactions
type: flow
status: current
related:
  - ../README.md
  - ../concepts/transaction-attachment.md
  - ../../assets/concepts/asset-status.md
  - ../../storage/README.md
---

# Fluxo: Adicionar Anexos à Transação (Upload e Otimização)

Este documento descreve o fluxo síncrono e assíncrono de upload, persistência e otimização de comprovantes anexados a transações financeiras.

## Diagrama de Sequência

```text
Cliente                  API (AddUseCase)              PostgreSQL            R2 Privado          Worker (BullMQ)
   |                             |                          |                    |                      |
   |-- POST /:id/attachments --->|                          |                    |                      |
   |   (multipart 1 a 3 files)   |-- Validação Síncrona --->|                    |                      |
   |                             |   (magic bytes, 5MB, 60MP)                    |                      |
   |                             |                          |                    |                      |
   |                             |-- BEGIN ---------------->|                    |                      |
   |                             |   SELECT FOR UPDATE tx   |                    |                      |
   |                             |   Valida type & limits   |                    |                      |
   |                             |   Cria Assets PENDING    |                    |                      |
   |                             |   Cria Attachments pos   |                    |                      |
   |                             |-- COMMIT --------------->|                    |                      |
   |                             |                          |                    |                      |
   |                             |-- putObject (original) ---------------------->|                      |
   |                             |                          |                    |                      |
   |                             |-- BEGIN ---------------->|                    |                      |
   |                             |   SELECT FOR UPDATE tx   |                    |                      |
   |                             |   markReady(assets)      |                    |                      |
   |                             |-- COMMIT --------------->|                    |                      |
   |                             |                          |                    |                      |
   |                             |-- Enfileira BullMQ ------------------------------------------------->|
   |                             |                          |                    |                      |
   |                             |-- buildSignedReadUrl --->|                    |                      |
   |                             |   (300s expiração)       |                    |                      |
   |<- 201 Created --------------|                          |                    |                      |
   |   [attachment com URL]      |                          |                    |                      |
   |                             |                          |                    |                      |
   |                             |                          |                    |   getObject(orig) <--|
   |                             |                          |                    |   Sharp 2560x2560    |
   |                             |                          |                    |   putObject(webp) -->|
   |                             |                          |   UPDATE lock a <--|                      |
   |                             |                          |   (se status READY)|                      |
```

## Etapas do Processamento

### 1. Validação Síncrona na Borda (API)
- Limite de até 3 arquivos por lote;
- Inspeciona magic bytes via `file-type` (somente `image/png`, `image/jpeg` e `image/webp`);
- Valida tamanho máximo de 5 MB por arquivo;
- Inspeciona dimensões com Sharp (`width * height <= 60_000_000` pixels).

### 2. Reserva Transacional Curta (PostgreSQL)
- Adquire lock pessimista (`SELECT FOR UPDATE`) na transação;
- Valida tipo (`INCOME` ou `EXPENSE`) e que a transação não está deletada;
- Valida que `activeCount + files.length <= 3`;
- Gera `Asset` com status `PENDING_UPLOAD` no bucket privado;
- Gera `TransactionAttachment` com posições ordinais sequenciais (0, 1, 2);
- Salva no banco e faz commit liberando o lock imediatamente.

### 3. Upload Físico ao Cloudflare R2
- Executa fora do lock do banco para não segurar conexões durante transferências de rede;
- Grava o arquivo original na storage key definitiva: `users/{userId}/transaction-attachments/{assetId}`;
- Aplica header `Cache-Control: private, max-age=300`.

### 4. Confirmação Transacional (`markReady`)
- Adquire lock curto novamente na transação;
- Se a transação tiver sido deletada durante o upload:
  - Marca os assets como `FAILED (TRANSACTION_DELETED)` -> `DELETE_PENDING`;
  - Rejeita a requisição com 404 (os bytes órfãos serão limpos pelo `AssetReconcilerService`);
- Se ativa:
  - Invoca `asset.markReady(...)` registrando metadados, checksum SHA-256 e tamanho original;
  - Enfileira jobs de otimização na fila BullMQ `transaction-attachments-optimization`.

### 5. Resposta com Presigned URLs
- Gera Presigned URL via `@aws-sdk/s3-request-presigner` com expiração de 300 segundos;
- Retorna HTTP 201 com array de anexos contendo `url`, `expiresAt` e `cacheMaxAgeSeconds = 240`.

### 6. Otimização Assíncrona no Worker (Best-Effort)
- O processor BullMQ (`concurrency: 1`) consome a mensagem `{ assetId, userId }`;
- Valida se o asset continua em `READY`. Se tiver mudado para `DELETE_PENDING` ou `DELETED`, aborta imediatamente;
- Baixa o original via `getObject`;
- Processa no Sharp: rotação por EXIF, redimensionamento proporcional cabendo em 2560x2560 sem ampliação, conversão para WebP qualidade 80;
- Sobrescreve o objeto no R2 na mesma key;
- Sob lock pessimista no asset, verifica novamente se continua `READY`;
- Atualiza `content_type = 'image/webp'`, novo checksum, novo tamanho e metadados no PostgreSQL.
