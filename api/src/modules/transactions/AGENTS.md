# Módulo Transactions — Instruções Locais

Este módulo é o núcleo do domínio financeiro da Danfy, responsável pelo registro de receitas (`INCOME`), despesas (`EXPENSE`), transferências (`TRANSFER`) e ajustes (`ADJUSTMENT`).

## Documentação Obrigatória
Antes de planejar ou alterar código neste módulo, leia:
- `docs/specs/` de transações e regras financeiras da plataforma.
- `docs/architecture/module-boundaries.md` — Regras de fronteira e dívida técnica documentada.
- Notion Spec: `Transaction Attachments — assets, galeria e processamento` (quando lidar com anexos).

## Regras de Domínio e Invariantes
- **Precisão Financeira:** Valores monetários são manipulados exclusivamente como inteiros seguros em centavos (`amountCents: number`, `Number.isSafeInteger()`). Nunca use float ou divisão com arredondamento arbitrário.
- **Transações `TRANSFER`:** Transferências possuem `account_id` e `destination_account_id`. A exclusão de transferência é estritamente proibida no domínio (`TransactionCannotDeleteTransferError`) e no banco (`CHK_transactions_transfer_not_deleted`).
- **Soft Delete:** A exclusão de transações comuns é um soft delete que preenche `deleted_at`. O saldo das contas é recalculado ignorando linhas soft-deletadas.
- **Anexos (Assets):** Transações não devem manipular diretamente SDK de storage; anexos são associados por chave estrangeira e marcados como `DELETE_PENDING` na mesma transação de exclusão da transação pai.
