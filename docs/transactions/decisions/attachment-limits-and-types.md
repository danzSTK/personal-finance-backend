---
area: transactions
type: decision
status: accepted
related:
  - ../README.md
  - ../concepts/transaction-attachment.md
---

# Decisão: Limites de Anexos e Restrição a Tipos de Transação

## Contexto

Diferentes tipos de transação financeira possuem comportamentos e ciclos de vida distintos na plataforma:
- `INCOME` e `EXPENSE` são lançamentos financeiros com contrapartida externa e exigem comprovação fiscal ou de pagamento.
- `TRANSFER` representa movimentação interna entre contas do próprio usuário e não pode ser deletada na V0 (`CHK_transactions_transfer_not_deleted`).
- `ADJUSTMENT` representa ajuste técnico automático de conciliação de saldo.

Além disso, permitir upload irrestrito de comprovantes geraria custos excessivos de armazenamento e complexidade visual na interface.

## Decisão

1. **Restrição por Tipo:** Apenas transações dos tipos `INCOME` e `EXPENSE` aceitam anexos. Tentativas de upload em `TRANSFER` ou `ADJUSTMENT` são rejeitadas com erro semântico de domínio (HTTP 409 `TransactionTypeDoesNotSupportAttachmentsError`).
2. **Capacidade Máxima de 3 Anexos:** Cada transação pode ter no máximo 3 anexos ativos simultaneamente (`activeCount + incomingFiles <= 3`).
3. **Validação de Formatos:** Apenas imagens nos formatos PNG, JPEG e WebP são aceitas (validação estrita por magic bytes via `file-type`).
4. **Teto de Resolução e Tamanho:** Limite de 5 MB por arquivo e teto de 60 Megapixels (`width * height <= 60_000_000`) para mitigar ataques de descompressão (*pixel flood*).

## Consequências

- Preservação da integridade do modelo de transferências e ajustes;
- Prevenção contra abusos de quota e consumo desnecessário de storage;
- Galeria limpa e de alta performance na interface do usuário.
