---
area: transactions
type: flow
status: current
related:
  - ../README.md
  - ../concepts/transaction-attachment.md
  - ../../assets/flows/delete-asset.md
  - ../../assets/flows/reconcile-assets.md
---

# Fluxo: Exclusão de Anexos (Individual e em Cascata)

Este documento descreve os fluxos de exclusão de comprovantes, tanto de forma individual quanto na exclusão da transação pai.

## 1. Exclusão Individual (`DELETE /transactions/:id/attachments/:attachmentId`)

Quando o usuário decide remover um comprovante específico da galeria:

1. **Lock Pessimista:** Adquire lock `FOR UPDATE` na transação financeira.
2. **Validação de Vínculo:** Localiza o registro em `transaction_attachments` para garantir que o anexo pertence àquela transação.
3. **Desassociação Imediata:** Remove a linha em `transaction_attachments` via `DELETE`.
4. **Reordenação Contígua:** Reordena as posições dos anexos remanescentes para `0 .. N-1` mantendo a ordem relativa anterior.
5. **Transição de Ciclo de Vida do Asset:** Localiza o `Asset` vinculado e, se estiver em `READY` ou `FAILED`, move para `DELETE_PENDING`.
6. **Desalocação Assíncrona:** A remoção física dos bytes no Cloudflare R2 e a marcação final para `DELETED` é realizada em segundo plano pelo `AssetReconcilerService`.

## 2. Exclusão em Cascata da Transação Pai (`DELETE /transactions/:id`)

Quando a transação financeira é excluída:

1. **Lock Pessimista e Soft Delete:** Sob transação com lock `FOR UPDATE`, executa `transaction.delete()`, gravando `deleted_at = now()`.
2. **Varredura de Anexos:** Consulta todos os `transaction_attachments` vinculados à transação.
3. **Marcação Atômica de Exclusão:** Para cada asset vinculado que esteja em `READY` ou `FAILED`, move o status para `DELETE_PENDING`.
4. **Sem Outbox / Sem Acoplamento:** Nenhuma chamada direta ao SDK S3 é feita no endpoint da API. O `AssetReconcilerService` varre os registros em `DELETE_PENDING` e limpa o bucket privado de forma idempotente e segura.
