---
area: transactions
feature: transaction-attachments
type: spec-requirements
status: approved
issue: 131
related:
  - ../../../../transactions/README.md
  - ../../../../assets/README.md
  - ../../../../assets/concepts/asset-status.md
  - ../../../../assets/flows/reconcile-assets.md
  - ../../../../storage/README.md
  - ../../../../architecture/module-boundaries.md
  - ../../../../database/schema.md
---

# Requirements — Transaction Attachments

## Objetivo

Permitir que usuários anexem até 3 comprovantes (imagens nos formatos PNG, JPEG ou WebP) por lançamento financeiro nas transações dos tipos `INCOME` e `EXPENSE`, mantendo os arquivos físicos protegidos no Cloudflare R2 Privado (`R2_PRIVATE_BUCKET_NAME`), acessíveis exclusivamente via Presigned URLs efêmeras de 5 minutos, e otimizados em segundo plano via fila BullMQ com Sharp sem bloquear a disponibilidade imediata do arquivo original.

## Contexto e Fontes

- GitHub Issue [#131](https://github.com/danzSTK/personal-finance-backend/issues/131).
- Página de Especificação no Notion: [📎 Transaction Attachments — assets, galeria e processamento](https://app.notion.com/p/3cec334aab3e818094b6dfbfa16742c8) (Decisões 1 a 27 consolidadas).
- Reconciliador de Assets: `docs/assets/flows/reconcile-assets.md` (Issue #127 / PR #130).
- Limites entre módulos: `docs/architecture/module-boundaries.md`.

## Escopo

- Extensão da porta `IObjectStorage` e `S3ObjectStorageAdapter` para suportar Presigned URLs de leitura (`buildSignedReadUrl`) contra o bucket privado e download de bytes (`getObject`).
- Migration criando a tabela intermediária `transaction_attachments` com índice único `(transaction_id, asset_id)` e ordenação explícita `position`.
- Migration expandindo `CHK_assets_purpose` para incluir `'TRANSACTION_ATTACHMENT'`.
- Restrição de tipo: apenas `INCOME` e `EXPENSE` aceitam anexos. `TRANSFER` e `ADJUSTMENT` rejeitam adições de anexo.
- Upload de 1 a 3 arquivos por lote com suporte a sucesso parcial e limite máximo de 3 anexos ativos (`PENDING_UPLOAD` + `READY`).
- Validação síncrona na API:
  - Validação estrita de magic bytes via `file-type` (PNG, JPEG, WebP).
  - Limite de 5 MB por arquivo.
  - Teto de resolução de 60 Megapixels (`width * height <= 60_000_000`) lido via metadata do Sharp.
- Upload do arquivo original diretamente para o bucket privado na key definitiva:
  `users/{userId}/transaction-attachments/{assetId}`
- Enfileiramento direto de job BullMQ para otimização assíncrona WebP (2560x2560, q80) com Sharp, verificando o estado `READY` sob lock antes de sobrescrever.
- Endpoints HTTP:
  - `GET /transactions` e `GET /transactions/:id`: incluem `attachmentsCount: number`.
  - `GET /transactions/:id/attachments`: endpoint dedicado da galeria retornando array completo com URLs assinadas válidas por 300s (`cacheMaxAgeSeconds = 240`).
  - `POST /transactions/:id/attachments`: upload multipart de até 3 arquivos.
  - `DELETE /transactions/:id/attachments/:attachmentId`: remoção individual (marca o asset como `DELETE_PENDING`).
  - `PATCH /transactions/:id/attachments/positions`: reordenação da galeria.
- Exclusão de transação (`DELETE /transactions/:id`): move atomicamente todos os anexos `READY` para `DELETE_PENDING`.
- Proteção contra corrida entre `PENDING_UPLOAD` e exclusão da transação (upload finaliza como `FAILED -> DELETE_PENDING` se a transação tiver sido deletada).
- Documentação viva em `docs/storage/README.md` e em `docs/transactions/`.

## Fora de Escopo

- Upload de PDFs, documentos ou vídeos.
- Upload direto do navegador ao R2 (sem passar pela API).
- Substituição atômica em comando único (`replace` é feito via DELETE + POST).
- Quota cumulativa de storage por usuário.

## Regras de Negócio

### 1. Tipos de Transação Suportados
- **WHEN** um anexo for submetido para uma transação com `type === INCOME || type === EXPENSE`,
- **THE SYSTEM SHALL** aceitar o anexo respeitando as demais regras de validação.
- **WHEN** um anexo for submetido para `TRANSFER` ou `ADJUSTMENT`,
- **THE SYSTEM SHALL** rejeitar a operação com erro de domínio/aplicação (`TransactionTypeDoesNotSupportAttachmentsError` -> HTTP 409).

### 2. Capacidade e Limite de Anexos Ativos
- **WHEN** uma transação receber novos anexos,
- **THE SYSTEM SHALL** adquirir lock pessimista (`FOR UPDATE`) na `Transaction` e calcular a contagem de ativos:
  `activeCount = COUNT(attachments WHERE asset.status IN ('PENDING_UPLOAD', 'READY'))`.
- **IF** `activeCount + incomingFilesCount > 3`,
- **THEN** a operação é rejeitada com HTTP 409 (`TransactionAttachmentLimitExceededError`).

### 3. Validação Síncrona de Arquivo
- **WHEN** um arquivo for recebido via multipart,
- **THE SYSTEM SHALL** inspecionar os bytes brutos:
  - Formato real deve ser `image/png`, `image/jpeg` ou `image/webp`.
  - Tamanho deve ser `<= 5 * 1024 * 1024` bytes (5 MB).
  - Resolução deve ser `width * height <= 60_000_000` pixels (60 MP).

### 4. Presigned URLs e Cache
- **WHEN** a galeria for consultada via `GET /transactions/:id/attachments`,
- **THE SYSTEM SHALL** retornar Presigned URLs com expiração de 300 segundos (5 minutos) geradas exclusivamente para `R2_PRIVATE_BUCKET_NAME`.
- O response deve indicar `cacheMaxAgeSeconds: 240` (4 minutos) para orientar o cache do TanStack Query com margem de segurança de 60s.
- Para evitar proliferação de tokens válidos, a emissão usa assinatura determinística por janela de tempo ou cache com TTL de 240s.

### 5. Otimização Assíncrona via BullMQ
- **WHEN** um arquivo original for persistido e o Asset avançar para `READY`,
- **THE SYSTEM SHALL** enfileirar um job na fila `transaction-attachments-optimization`.
- O worker executa a otimização de forma best-effort (se falhar, o original permanece válido em `READY`).
- Antes de sobrescrever o R2 e persistir metadados, o worker valida se o Asset continua em `READY`. Se tiver mudado para `DELETE_PENDING` ou `DELETED`, aborta a sobrescrita.

### 6. Exclusão Atômica e Reconciliação
- **WHEN** o usuário excluir uma transação (`DELETE /transactions/:id`),
- **THE SYSTEM SHALL** adquirir lock `FOR UPDATE` na transação, registrar `deleted_at = now()` e marcar como `DELETE_PENDING` todos os assets vinculados que estejam em `READY`. A remoção física dos bytes é delegada ao `AssetReconcilerService`.
- **WHEN** o usuário excluir um anexo individualmente (`DELETE /transactions/:id/attachments/:attachmentId`),
- **THE SYSTEM SHALL** remover o vínculo em `transaction_attachments`, reordenar as posições restantes e marcar o asset como `DELETE_PENDING`.

## Critérios de Aceitação

- [ ] **AC-1:** Usuário anexa até 3 imagens válidas (PNG/JPEG/WebP) em transações `INCOME` e `EXPENSE`, gravadas no bucket privado, e recebe confirmação com status `READY`.
- [ ] **AC-2:** Transações `TRANSFER` e `ADJUSTMENT` rejeitam anexos com HTTP 409 e erro semântico.
- [ ] **AC-3:** Envio de imagem que excede 5 MB, 60 MP ou com MIME falso é rejeitado com HTTP 400/413/415 antes de qualquer upload ao R2.
- [ ] **AC-4:** Envio que ultrapassa 3 anexos ativos na transação é rejeitado com HTTP 409 sob lock transacional.
- [ ] **AC-5:** `GET /transactions` e `GET /transactions/:id` retornam `attachmentsCount` correto.
- [ ] **AC-6:** `GET /transactions/:id/attachments` retorna o array ordenado com Presigned URLs válidas por 300s e `cacheMaxAgeSeconds = 240`.
- [ ] **AC-7:** Worker do BullMQ otimiza imagens para WebP 2560x2560 q80 e atualiza metadados sem alterar a storage key estável.
- [ ] **AC-8:** Otimização do BullMQ aborta sem sobrescrever se o anexo foi excluído durante o processamento.
- [ ] **AC-9:** `DELETE /transactions/:id` marca os anexos como `DELETE_PENDING` atomicamente na mesma transação PostgreSQL.
- [ ] **AC-10:** `PATCH /transactions/:id/attachments/positions` reordena as posições dos anexos atomicamente.
