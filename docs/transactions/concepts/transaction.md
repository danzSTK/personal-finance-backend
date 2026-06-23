---
area: transactions
type: concept
status: draft
related:
  - ./transaction-type.md
  - ./transaction-status.md
  - ./transaction-date.md
  - ./transaction-amount.md
  - ../../accounts/concepts/account.md
  - ../../categories/README.md
---

# Transaction

Uma transaction representa um lançamento financeiro do usuário.

Ela registra um fato financeiro que aconteceu, vai acontecer ou precisa ser acompanhado dentro da vida financeira do usuário.

O sistema não movimenta dinheiro de verdade. Ele apenas registra, organiza, calcula e projeta movimentações financeiras.

## Objetivo

O objetivo de uma transaction é preservar o histórico financeiro do usuário de forma simples e confiável.

Ela deve permitir que o sistema responda perguntas como:

- quanto entrou?
- quanto saiu?
- quando aconteceu ou deve acontecer?
- em qual account isso impacta?
- qual foi o motivo financeiro do lançamento?
- isso já aconteceu ou ainda é uma previsão?

## Definição

Uma transaction é o registro de um evento financeiro vinculado ao usuário.

Exemplos:

- salário recebido;
- compra no débito;
- pix enviado;
- boleto pago;
- transferência entre accounts próprias;
- ajuste manual de saldo;
- conta cadastrada como pendente;
- recebimento previsto.

A transaction deve ser simples de cadastrar, mas pode gerar comportamentos internos diferentes dependendo de seu tipo, status e vínculos.

## Modelo Mental

O usuário não deve precisar entender contabilidade para cadastrar uma transaction.

Ele deve apenas informar o que aconteceu ou o que está previsto para acontecer.

Exemplos de intenção do usuário:

- “recebi dinheiro”;
- “gastei dinheiro”;
- “vou pagar isso depois”;
- “transferi entre minhas contas”;
- “preciso corrigir o saldo”.

A regra de domínio decide como esse lançamento afeta histórico, saldo atual, saldo previsto, pendências e leituras futuras.

## Campos Conceituais

Uma transaction é formada, conceitualmente, por:

- usuário dono do lançamento;
- account relacionada;
- category relacionada;
- tipo financeiro;
- status;
- data financeira;
- valor;
- descrição opcional.

A modelagem exata dos campos pode evoluir, mas esses conceitos são a base do domínio.

## Relação Com Account

Transaction não é uma account.

Account representa o lugar lógico onde o usuário acompanha dinheiro.

Transaction representa um lançamento que pode impactar uma account.

A regra de saldo da account deve continuar derivada do histórico financeiro, não de um saldo manual salvo diretamente na account.

## Relação Com Category

Transaction não é uma category.

Category representa a semântica financeira do lançamento.

Ela ajuda o sistema a entender se aquele lançamento é receita, despesa, transferência, ajuste, investimento ou outro tipo futuro.

Uma transaction usa category para classificar o motivo financeiro do lançamento, mas a regra de gerenciamento de categorias pertence ao domínio de categories.

## O Que Transaction Não É

Transaction não deve representar tudo.

Não use transaction para representar:

- account, porque account é o lugar lógico onde o usuário acompanha dinheiro;
- category, porque category classifica a semântica financeira do lançamento;
- regra recorrente, porque recorrência é uma regra que pode gerar transactions;
- relatório, porque relatório é leitura derivada do histórico;
- fatura de cartão, porque fatura precisa de regras próprias quando o módulo de cartão for consolidado;
- anexo ou comprovante, porque isso deve ser tratado por assets quando existir;
- pagamento real, porque o sistema apenas registra o que o usuário informa.

## Segurança

Toda transaction pertence a um `userId`.

O `userId` deve vir da sessão autenticada. O frontend nunca deve enviar `userId` no body.

Qualquer `accountId` usado na transaction precisa pertencer ao mesmo usuário autenticado.

Qualquer `categoryId` usado na transaction precisa pertencer ao mesmo usuário autenticado.

A aplicação nunca deve permitir que uma transaction conecte dados de usuários diferentes.

## Regra Central

Uma transaction deve preservar o histórico financeiro sem exigir complexidade no cadastro.

A regra por trás pode ser rigorosa, mas a experiência de criação deve continuar simples.

O domínio deve proteger consistência, ownership e cálculos, enquanto o usuário só informa o lançamento financeiro.
