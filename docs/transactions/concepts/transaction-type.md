---
area: transactions
type: concept
status: draft
related:
  - ./transaction.md
  - ../../categories/decisions/categories.md
  - ../../accounts/decisions/transfers-are-neutral.md
---

# Transaction Type

Transaction type representa a natureza do lançamento financeiro.

Ele ajuda o domínio a decidir se a transaction representa entrada, saída, movimentação interna ou correção técnica.

## Tipos Planejados Para V0

### `INCOME`

Representa entrada de dinheiro.

Exemplos:

- salário;
- pix recebido;
- venda;
- rendimento recebido;
- reembolso enquanto a regra própria de estorno não existir.

### `EXPENSE`

Representa saída de dinheiro.

Exemplos:

- mercado;
- aluguel;
- transporte;
- assinatura;
- boleto pago;
- pix enviado.

### `TRANSFER`

Representa movimentação entre accounts do próprio usuário.

Transferência não é receita nem despesa. Ela é neutra para resultado financeiro.

A regra principal de transferência também existe em [Transfers are neutral](../../accounts/decisions/transfers-are-neutral.md).

### `ADJUSTMENT`

Representa correção técnica de saldo.

Deve ser usada quando o usuário precisa corrigir divergência depois que a account já possui movimentação.

Ajuste não é receita comum nem despesa comum.

## Fora Da V0

`CREDIT_CARD`, `INSTALLMENT`, `INVOICE_PAYMENT`, `REFUND` e `INVESTMENT` ainda precisam de decisão própria antes de virarem tipos principais de transaction.

Esses casos devem ficar em open questions até seus domínios estarem mais maduros.
