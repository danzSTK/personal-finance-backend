---
area: transactions
feature: transaction-attachments
type: spec-decisions
status: approved
issue: 131
related:
  - ./requirements.md
  - ./design.md
  - ./tasks.md
---

# Decisions — Transaction Attachments

## DEC-001 - Bucket Privado com Presigned URLs de Leitura (5 min R2 / 4 min TanStack)

Status: accepted

Decision:
Armazenar todos os comprovantes e anexos de transações no bucket privado (`R2_PRIVATE_BUCKET_NAME`). O acesso de leitura é feito através de Presigned URLs geradas pelo `@aws-sdk/s3-request-presigner` com validade de 300 segundos no R2 e janela de cache de 240 segundos (`cacheMaxAgeSeconds`) para o frontend.

Reason:
Comprovantes financeiros contêm dados altamente sensíveis (nomes, CPFs, chaves PIX, valores e dados bancários). Não podem ser expostos em bucket público ou CDN aberta. A janela de 5 min no R2 combinada com 4 min no frontend oferece equilíbrio ideal entre segurança e reuso de cache sem requisições excessivas.

Impact:
Extensão da porta `IObjectStorage` com `buildSignedReadUrl` e `getObject`.

---

## DEC-002 - Galeria por Tabela Intermediária `transaction_attachments` com `position` Explícita

Status: accepted

Decision:
Separar o vínculo de negócio da identidade do arquivo através da tabela `transaction_attachments` contendo `transaction_id`, `asset_id` e a coluna `position` (0 a 2).

Reason:
Mantém a tabela `transactions` pura (sem colunas de storage ou metadados de arquivos) e preserva `assets` como a fonte única da verdade sobre o ciclo de vida dos arquivos. A ordem da galeria é uma propriedade da associação de negócio, não do arquivo físico.

Impact:
Permite reordenação (`PATCH /positions`) sem tocar na tabela `assets` nem renomear arquivos no R2.

---

## DEC-003 - Restrição de Anexos Exclusivamente para `INCOME` e `EXPENSE`

Status: accepted

Decision:
Rejeitar adições de anexos para transações do tipo `TRANSFER` e `ADJUSTMENT` com erro de domínio/aplicação (HTTP 409).

Reason:
Transferências (`TRANSFER`) são movimentações internas entre contas do próprio usuário na aplicação e têm exclusão estritamente proibida no modelo atual (`TransactionCannotDeleteTransferError` + `CHK_transactions_transfer_not_deleted`). Ajustes de saldo (`ADJUSTMENT`) são gerados automaticamente pelo sistema. Permitir anexos nesses tipos criaria complexidade de ciclo de vida e não atende a uma necessidade real de produto.

Impact:
Uma validação simples no use case garante a integridade sem impactar queries de listagem.

---

## DEC-004 - Otimização Assíncrona Best-Effort via BullMQ com Lock de Verificação

Status: accepted

Decision:
O anexo fica imediatamente disponível (`READY`) após o upload do original. A otimização para WebP (2560x2560, q80) roda assincronamente em job isolado no BullMQ. Antes de sobrescrever o R2 e atualizar o banco, o worker verifica sob lock pessimista se o asset continua em `READY`.

Reason:
Garante latência baixa no upload para o usuário final. Se o anexo tiver sido excluído enquanto o Sharp rodava no worker, o lock impede que o worker recrie um arquivo deletado no R2 ou reverta um asset que já está em `DELETE_PENDING`. Se a otimização falhar, o anexo continua perfeitamente funcional usando o arquivo original.

Impact:
Alta resiliência sem bloqueios síncronos na API.

---

## DEC-005 - Exclusão Transacional sem Outbox Delegada ao `AssetReconcilerService`

Status: accepted

Decision:
Ao excluir uma transação (`DELETE /transactions/:id`), todos os anexos vinculados em `READY` são atualizados para `DELETE_PENDING` na mesma transação PostgreSQL do soft delete da transação, sem emitir eventos na Transactional Outbox.

Reason:
A Issue #127 implementou o `AssetReconcilerService` exatamente para realizar a varredura e desalocação física idempotente no R2 de qualquer asset em `DELETE_PENDING`. Evita acoplamento entre os domínios de transação e storage e dispensa filas ou outbox desnecessárias.

Impact:
Operação de deleção rápida, atômica e consistente no PostgreSQL.
