---
area: transactions
type: concept
status: current
related:
  - ../README.md
  - ../../assets/README.md
  - ../../storage/README.md
  - ../decisions/private-bucket-and-presigned-urls.md
  - ../decisions/attachment-limits-and-types.md
---

# Transaction Attachment

Transaction Attachment é o conceito que representa a associação de um comprovante financeiro (recibo, cupom fiscal, nota fiscal ou comprovante de pagamento) a uma transação financeira.

## Separação em Três Camadas

A arquitetura adota uma separação rigorosa de responsabilidades entre três entidades:

1. **`Transaction` (Domínio Financeiro):**
   - Agregado raiz da transação (`INCOME` ou `EXPENSE`).
   - Não conhece URLs, buckets, bytes físicos, resoluções ou metadados de imagem.
   - Contém apenas a contagem projetada de anexos ativos (`attachmentsCount`).

2. **`TransactionAttachment` (Associação e Galeria):**
   - Tabela associativa `transaction_attachments` com chave estrangeira para `transactions` (`ON DELETE CASCADE`) e `assets` (`ON DELETE RESTRICT`).
   - Mantém a propriedade ordinal `position` (0 a 2), que define a ordem visual dos comprovantes na galeria.
   - Garante que a transação possa ter até 3 comprovantes ordenados, sem acoplar a ordem visual ao asset físico.

3. **`Asset` (Módulo Assets / Object Storage):**
   - Controla o ciclo de vida do arquivo (`PENDING_UPLOAD`, `READY`, `DELETE_PENDING`, `DELETED`, `FAILED`).
   - Mantém metadados técnicos de armazenamento (`bucket`, `storageKey`, `contentType`, `sizeBytes`, `checksum`, `metadata`).
   - Fica isolado no bucket privado (`R2_PRIVATE_BUCKET_NAME`), protegido contra acesso público direto.

## Invariantes da Galeria

- **Capacidade Máxima:** Cada transação pode possuir no máximo 3 anexos ativos simultaneamente (`CHK_transaction_attachments_position` check `position >= 0 AND position <= 2`).
- **Unicidade de Vínculo:** Uma mesma transação não pode vincular o mesmo asset duas vezes (`UQ_transaction_attachments_transaction_asset`).
- **Unicidade de Posição:** Não podem existir duas imagens ocupando a mesma posição na galeria (`UQ_transaction_attachments_transaction_position`).
- **Reordenação Atômica:** A troca de posições é realizada em transação PostgreSQL, sem alterar storage keys ou dados físicos no R2.
