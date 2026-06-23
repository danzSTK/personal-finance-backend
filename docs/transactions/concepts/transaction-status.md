---
area: transactions
type: concept
status: draft
related:
  - ./transaction.md
  - ./transaction-date.md
  - ../decisions/pending-transactions-do-not-affect-current-balance.md
---

# Transaction Status

Transaction status representa se o lançamento já aconteceu de fato ou se ainda é uma previsão.

O status define se a transaction entra no saldo atual ou apenas em leituras previstas.

## Objetivo

O objetivo do status é separar realidade financeira de planejamento financeiro.

O usuário pode cadastrar algo que já aconteceu ou algo que ainda vai acontecer.

O domínio deve tratar esses dois casos de forma diferente.

## Status Planejados Para V0

### `PENDING`

A transaction foi registrada, planejada ou prevista, mas ainda não foi confirmada como realizada.

Exemplos:

- salário previsto;
- conta que vence no futuro;
- despesa cadastrada antes do pagamento;
- recebimento esperado;
- transferência planejada;
- ajuste planejado.

Regra:

- não afeta saldo atual;
- pode afetar saldo previsto;
- pode aparecer em pendências;
- pode ser confirmada depois;
- continua existindo no histórico como previsão enquanto não for efetivada.

Uma transaction com data futura deve nascer como `PENDING`, porque a data informada representa quando o lançamento deve acontecer, não que ele já aconteceu.

### `EFFECTIVE`

A transaction aconteceu de fato.

Exemplos:

- salário recebido;
- boleto pago;
- pix enviado;
- despesa confirmada;
- transferência realizada;
- ajuste aplicado.

Regra:

- afeta saldo atual;
- entra no histórico financeiro real;
- deixa de ser apenas previsão;
- pode continuar aparecendo em relatórios e listagens históricas.

## Estado Lógico Derivado

Uma transaction `PENDING` pode ter estados lógicos derivados a partir da data financeira.

Esses estados não precisam ser enums persistidos na V0.

### Pendente futura

A transaction está pendente e sua data financeira ainda não chegou.

Exemplo:

Hoje é dia 5 e o usuário cadastrou o aluguel para o dia 10.

Regra:

- continua `PENDING`;
- aparece como previsão futura;
- não afeta saldo atual.

### Pendente atrasada

A transaction está pendente e sua data financeira já passou.

Exemplo:

Hoje é dia 12 e o usuário cadastrou uma conta para o dia 10, mas ainda não confirmou o pagamento.

Regra:

- continua `PENDING`;
- pode aparecer como atraso;
- não afeta saldo atual;
- pode gerar alerta, notificação ou destaque visual no futuro.

## Por Que Não Criar `OVERDUE` Na V0

`OVERDUE` é um estado derivado do tempo.

Se fosse persistido como status, o sistema precisaria atualizar transactions automaticamente quando a data passasse.

Na V0, é melhor calcular esse estado em leitura:

```text
status = PENDING
date < today
```

Isso mantém o domínio mais simples e evita jobs desnecessários.

## Confirmação

Confirmar uma transaction significa mudar seu status de `PENDING` para `EFFECTIVE`.

A confirmação representa que o lançamento deixou de ser previsão e passou a ser realidade financeira.

Durante a confirmação, é permitido ajustar os dados da transaction para refletir o que realmente aconteceu.

Exemplo:

- uma despesa recorrente cadastrada para o dia 15 pode ser paga no dia 3;
- o valor pago pode ser diferente do valor originalmente registrado, por desconto ou negociação.

Nesse momento, o usuário pode alterar:

- valor;
- data financeira;
- outros campos relevantes.

Na V0, o sistema pode simplesmente substituir os valores originais pelos valores confirmados, sem necessidade de armazenar o valor planejado separadamente.

Essa decisão mantém o domínio mais simples e atende o objetivo principal de refletir a realidade financeira.

Quando confirmada, a transaction passa a afetar o saldo atual conforme seu type.

A confirmação também deve registrar a data de efetivação da transaction.

Essa data representa quando o lançamento passou a ser considerado realizado no histórico financeiro.

A modelagem exata entre `date` e `effectiveAt` deve ser detalhada em [Transaction Date](./transaction-date.md).

## Regra Central

Na V0, transaction status deve ter apenas dois estados persistidos:

- `PENDING`;
- `EFFECTIVE`.

Estados como futura ou atrasada devem ser derivados por data.
