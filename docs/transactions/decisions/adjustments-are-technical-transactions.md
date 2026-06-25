---
area: transactions
type: decision
status: draft
related:
  - ../concepts/transaction-type.md
  - ../concepts/transaction-amount.md
  - ../../categories/decisions/categories.md
  - ../../accounts/concepts/account-balance.md
---

# Adjustments Are Technical Transactions

## Decisão

Ajustes de saldo devem ser tratados como transactions técnicas.

No domínio de transactions, um ajuste deve ser representado com type `ADJUSTMENT`.

## Contexto

Ajuste existe para corrigir divergências entre o saldo calculado pelo app e a realidade informada pelo usuário.

Exemplo:

O app mostra R$ 980 na account, mas o usuário verificou que o saldo real é R$ 1.000.

Nesse caso, o usuário precisa aplicar uma correção de R$ 20.

## Motivos

- Preserva histórico de correções.
- Evita alterar `initialBalanceCents` depois que a account já possui movimentação.
- Mantém o saldo derivado do histórico.
- Permite rastrear por que o saldo foi corrigido.
- Evita tratar correção como receita ou despesa comum.

## Relação Com Account Balance

O saldo da account deve continuar sendo derivado.

Depois que uma account possui movimentação, correções não devem ser feitas alterando `initialBalanceCents`.

A correção deve entrar no histórico como uma transaction técnica.

## Relação Com Categories

A category técnica `ADJUSTMENT` já é prevista no domínio de categories.

Transactions de ajuste devem usar essa semântica técnica.

Essa category não deve aparecer como categoria comum de receita ou despesa.

## Impacto No Saldo

Um ajuste pode aumentar ou reduzir o saldo de uma account.

Como `amount` deve continuar positivo, a direção do ajuste deve ser explícita.

Modelo recomendado:

```text
type = ADJUSTMENT
amount = 20
direction = INCREASE
```

ou:

```text
type = ADJUSTMENT
amount = 20
direction = DECREASE
```

## Direction

`direction` representa a direção do ajuste de saldo.

Na V0, `direction` é exclusivo de transactions com type `ADJUSTMENT`.

Transactions dos tipos `INCOME`, `EXPENSE` e `TRANSFER` não devem usar `direction`.

Regra:

- se `type = ADJUSTMENT`, `direction` é obrigatório;
- se `type != ADJUSTMENT`, `direction` deve ser vazio.

Isso evita que alguém tente usar `direction` para inverter o comportamento de outros tipos de transaction.

## Por Que Não Usar Valor Negativo

Ajuste não deve usar valor negativo para indicar redução.

Exemplo errado:

```text
type = ADJUSTMENT
amount = -20
```

Motivo:

- quebra a decisão de `amount > 0`;
- cria exceção desnecessária;
- dificulta cálculo e validação;
- esconde a intenção do ajuste no sinal do número.

## Por Que Não Criar Types Separados

Evitar:

```text
ADJUSTMENT_INCREASE
ADJUSTMENT_DECREASE
```

Motivo:

- polui o enum de `TransactionType`;
- mistura natureza da transaction com direção;
- dificulta evolução futura;
- torna o domínio menos consistente.

A natureza é `ADJUSTMENT`.

A direção é um detalhe exclusivo do ajuste.

## Motivo Do Ajuste

Um ajuste deve exigir motivo ou observação.

Exemplos:

- correção de saldo inicial informado errado;
- divergência com extrato bancário;
- lançamento antigo esquecido;
- correção manual feita pelo usuário.

Isso ajuda o usuário a entender por que o saldo foi alterado.

## Impacto Em Relatórios

Ajuste não deve entrar como receita comum.

Ajuste não deve entrar como despesa comum.

Ele pode aparecer em relatórios técnicos, auditoria simples ou histórico da account, mas não deve poluir relatórios comuns de renda e gastos.

## Regra Técnica

Uma transaction `ADJUSTMENT` deve ter:

- account;
- amount positivo;
- direction;
- motivo ou observação;
- status;
- date;
- `effectiveAt` quando efetivada;
- category técnica `ADJUSTMENT`.

Para qualquer transaction que não seja `ADJUSTMENT`, `direction` deve permanecer vazio.

## Regra Central

Ajuste corrige saldo.

Ajuste não representa renda, gasto ou transferência.

Ajuste deve preservar histórico sem quebrar a regra de saldo derivado.
