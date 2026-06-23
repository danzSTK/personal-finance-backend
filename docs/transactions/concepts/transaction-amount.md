---
area: transactions
type: concept
status: draft
related:
  - ./transaction.md
  - ./transaction-type.md
  - ../decisions/transaction-amount-is-positive.md
---

# Transaction Amount

Transaction amount representa o valor monetário do lançamento.

Na V0, toda transaction deve armazenar `amount` como valor positivo.

O tipo da transaction define como esse valor afeta o histórico financeiro.

## Objetivo

O objetivo do amount é registrar quanto dinheiro está envolvido no lançamento.

Ele não deve carregar sozinho a direção financeira.

A direção deve vir do type da transaction e, quando necessário, de campos próprios da modelagem.

## Regra Principal

`amount` deve ser sempre maior que zero.

Exemplo correto:

```text
type = EXPENSE
amount = 100
```

Exemplo errado:

```text
type = EXPENSE
amount = -100
```

Uma despesa de R$ 100 deve ser salva como `amount = 100`.

O domínio decide que esse valor diminui saldo porque o type é `EXPENSE`.

## Impacto Por Type

### `INCOME`

`amount` representa o valor que entra.

Quando a transaction estiver efetivada, esse valor aumenta o saldo da account.

### `EXPENSE`

`amount` representa o valor que sai.

Quando a transaction estiver efetivada, esse valor diminui o saldo da account.

### `TRANSFER`

`amount` representa o valor movimentado entre accounts do mesmo usuário.

A mesma quantia sai da account de origem e entra na account de destino.

Transferência não deve usar valor negativo para representar saída.

### `ADJUSTMENT`

`amount` representa o valor da correção.

A direção do ajuste ainda precisa ser definida pela modelagem final.

Opções possíveis:

- campo de direção;
- type específico para ajuste positivo e negativo;
- outra estratégia explícita do domínio.

Mesmo em ajuste, `amount` deve continuar positivo.

## Por Que Não Usar Valor Negativo

Valores negativos parecem simples no começo, mas deixam o domínio ambíguo.

Exemplos de problemas:

- despesa com valor negativo poderia virar receita na prática;
- receita com valor negativo poderia virar despesa;
- relatórios precisariam tratar várias combinações inválidas;
- transferência ficaria confusa porque tem saída e entrada ao mesmo tempo;
- ajuste poderia esconder a intenção real do usuário.

Por isso, a V0 deve manter uma regra simples:

```text
amount > 0
```

## Precisão Monetária

`amount` deve representar dinheiro de forma segura.

A implementação não deve depender de `float` para cálculo monetário.

A decisão técnica de usar decimal, integer em centavos ou outra estratégia deve ser tratada na implementação/schema.

No domínio, a regra é:

- o valor precisa ser maior que zero;
- o valor precisa preservar precisão monetária;
- o valor não deve aceitar `NaN`, infinito ou formatos inválidos.

## Schema Atual

O schema atual já protege parte dessa regra com constraint:

```text
amount > 0
```

Essa regra deve continuar existindo no schema final.

## Regra Central

Transaction amount sempre representa valor absoluto.

Quem decide o impacto financeiro é o domínio, não o sinal do número.
