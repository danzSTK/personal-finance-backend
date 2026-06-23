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

Transaction type representa a natureza financeira do lançamento.

Ele ajuda o domínio a decidir como uma transaction deve ser interpretada no histórico financeiro.

O type não existe para explicar a tela ou a forma de pagamento. Ele existe para definir a semântica principal do lançamento.

## Objetivo

O objetivo do transaction type é responder:

- isso é uma entrada de dinheiro?
- isso é uma saída de dinheiro?
- isso é uma movimentação interna entre accounts?
- isso é uma correção técnica de saldo?

## Tipos Planejados Para V0

### `INCOME`

Representa entrada de dinheiro.

Exemplos:

- salário;
- pix recebido;
- venda;
- rendimento recebido;
- reembolso enquanto a regra própria de estorno não existir.

Regra:

- aumenta o saldo da account quando a transaction estiver efetivada;
- pode entrar em relatórios de receita;
- deve usar category compatível com receita.

### `EXPENSE`

Representa saída de dinheiro.

Exemplos:

- mercado;
- aluguel;
- transporte;
- assinatura;
- boleto pago;
- pix enviado.

Regra:

- diminui o saldo da account quando a transaction estiver efetivada;
- pode entrar em relatórios de despesa;
- deve usar category compatível com despesa.

### `TRANSFER`

Representa movimentação entre accounts do próprio usuário.

Exemplos:

- transferência da account banco para account carteira;
- saque de banco para dinheiro físico;
- movimentação entre duas accounts próprias.

Regra:

- não é receita;
- não é despesa;
- não altera o resultado financeiro total do usuário;
- pode alterar o saldo das accounts envolvidas;
- deve ser neutra em relatórios de receita e despesa.

A regra principal de transferência também existe em [Transfers are neutral](../../accounts/decisions/transfers-are-neutral.md).

### `ADJUSTMENT`

Representa correção técnica de saldo.

Exemplos:

- corrigir saldo depois de erro de cadastro;
- ajustar divergência entre saldo do app e saldo real;
- registrar correção depois que a account já possui movimentações.

Regra:

- não é receita comum;
- não é despesa comum;
- deve existir para preservar histórico de correções;
- deve usar semântica técnica de ajuste;
- pode aumentar ou diminuir saldo conforme a direção definida pela modelagem final.

## Relação Com Category

Transaction type e category não são a mesma coisa.

O type define o comportamento financeiro principal da transaction.

A category classifica o motivo financeiro do lançamento.

Exemplo:

Uma transaction `EXPENSE` pode usar category `Alimentação`.

Uma transaction `INCOME` pode usar category `Salário`.

Uma transaction `TRANSFER` deve usar semântica técnica de transferência.

Uma transaction `ADJUSTMENT` deve usar semântica técnica de ajuste.

O domínio deve impedir combinações incompatíveis entre type e category.

## O Que Type Não É

Transaction type não deve representar:

- banco;
- account;
- categoria visual;
- recorrência;
- forma de pagamento;
- fatura;
- parcela;
- comprovante;
- relatório.

Essas coisas pertencem a outros conceitos ou módulos.

## Fora Da V0

Os seguintes casos não devem virar tipos principais de transaction na V0:

- `CREDIT_CARD`;
- `INSTALLMENT`;
- `INVOICE_PAYMENT`;
- `REFUND`;
- `INVESTMENT`.

Motivo:

Esses casos precisam de regras próprias antes de entrarem no núcleo de transactions.

Cartão de crédito precisa de fatura, fechamento, vencimento, pagamento e parcelamento.

Recorrência deve ser uma regra que gera transactions, não um type de transaction.

Reembolso pode começar simples, mas futuramente deve ter regra própria para estornar ou reduzir uma despesa original.

Investimento existe como tipo de account/category, mas ainda precisa de decisão própria antes de afetar o comportamento de transaction.

## Regra Central

Na V0, transaction type deve ser pequeno e estável.

O domínio deve começar com:

- `INCOME`;
- `EXPENSE`;
- `TRANSFER`;
- `ADJUSTMENT`.

Novos tipos só devem ser adicionados quando houver regra de negócio clara para eles.
