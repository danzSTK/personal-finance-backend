---
area: transactions
type: decision
status: draft
related:
  - ../concepts/transaction-type.md
  - ../../accounts/decisions/transfers-are-neutral.md
  - ../../accounts/flows/transfer-between-accounts.md
---

# Transfers Are Neutral

## Decisão

Transferências entre accounts do próprio usuário não contam como receita nem despesa.

No domínio de transactions, uma transferência deve ser representada com type `TRANSFER`.

## Contexto

Uma transferência representa movimentação interna de dinheiro.

Exemplos:

- mover dinheiro da account banco para account carteira;
- sacar dinheiro da conta bancária para dinheiro físico;
- mover dinheiro entre duas accounts próprias;
- enviar dinheiro de uma account principal para uma account separada de reserva.

Mesmo que o dinheiro saia de uma account e entre em outra, o usuário não ficou mais rico nem mais pobre por causa da transferência.

## Motivos

- Não altera o total financeiro do usuário.
- Representa deslocamento interno entre accounts.
- Não deve entrar em relatórios comuns de receita ou despesa.
- Evita falsa receita na account de destino.
- Evita falsa despesa na account de origem.
- Mantém relatórios de consumo e renda mais corretos.

## Relação Com Accounts

A regra principal de transferência pertence ao fluxo entre accounts.

Este arquivo registra apenas como transactions devem respeitar essa decisão no histórico financeiro.

Documentação relacionada:

- [Accounts transfers are neutral](../../accounts/decisions/transfers-are-neutral.md)
- [Transfer between accounts](../../accounts/flows/transfer-between-accounts.md)

## Impacto No Saldo

Uma transferência efetivada pode alterar o saldo das accounts envolvidas.

Regra conceitual:

- diminui saldo da account de origem;
- aumenta saldo da account de destino;
- não altera o total financeiro agregado do usuário.

Exemplo:

O usuário transfere R$ 100 da account banco para a account carteira.

Resultado:

```text
account banco: -100
account carteira: +100
total do usuário: 0
```

## Impacto Em Relatórios

Transferência não deve entrar como receita.

Transferência não deve entrar como despesa.

Ela pode aparecer em relatórios ou listagens específicas de movimentações internas, mas não em relatórios comuns de renda, gastos ou resultado financeiro.

## Categoria Técnica

Uma transaction `TRANSFER` deve usar semântica técnica de transferência.

O domínio de categories já prevê category técnica `TRANSFER`.

Essa category não deve ser tratada como categoria comum de receita ou despesa.

## Taxas Em Transferência

Se uma transferência tiver taxa, a taxa não deve ser embutida na transferência principal.

A taxa deve ser registrada como uma transaction separada de despesa.

Exemplo:

Transferência de R$ 1.000 com taxa de R$ 5.

Resultado conceitual:

- transaction `TRANSFER` de R$ 1.000;
- transaction `EXPENSE` de R$ 5 na category de taxas.

Isso mantém a transferência neutra e registra corretamente o gasto real.

## Regra Técnica

Uma transferência deve ser registrada de forma atômica.

Ou todos os efeitos da transferência são persistidos, ou nenhum efeito é persistido.

A transferência também deve manter vínculo claro entre origem e destino.

## Modelagem Pendente

Ainda falta decidir como a transferência será persistida.

Possibilidades:

- uma transaction composta com account de origem e account de destino;
- duas transaction lines vinculadas;
- outra estrutura específica para movimentações internas.

Independentemente da modelagem escolhida, a regra de negócio permanece:

Transferência é neutra para receita, despesa e resultado financeiro.

## Regra Central

Transferência movimenta dinheiro entre accounts próprias.

Ela altera saldos individuais, mas não cria renda nem gasto.
