---
area: transactions
type: decision
status: draft
related:
  - ../concepts/transaction-status.md
  - ../concepts/transaction-date.md
  - ../../accounts/concepts/account-balance.md
---

# Pending Transactions Do Not Affect Current Balance

## Decisão

Transactions pendentes não devem afetar o saldo atual da account.

Elas podem afetar projeções, pendências e saldo previsto, mas não o saldo real.

## Contexto

Uma transaction pode representar algo que ainda não aconteceu.

Exemplos:

- salário previsto;
- conta a pagar;
- despesa cadastrada antes do pagamento;
- recebimento esperado;
- transferência planejada.

Esses lançamentos são úteis para planejamento, mas ainda não representam realidade financeira.

## Motivos

- Saldo atual deve representar apenas o que já aconteceu.
- Pendências podem mudar antes da confirmação.
- O usuário precisa diferenciar realidade financeira de previsão.
- Uma transaction pendente pode ser editada antes de ser efetivada.
- Uma transaction pendente pode nunca acontecer.
- Uma transaction pendente pode acontecer com valor ou data diferente do previsto.

## Regra Técnica

O cálculo de saldo atual deve considerar apenas transactions com status `EFFECTIVE`.

Transactions com status `PENDING` devem ser ignoradas no cálculo de saldo atual.

Regra esperada:

```text
currentBalance = initialBalance + effective transactions
```

O cálculo de saldo previsto pode considerar transactions pendentes conforme a regra do produto.

Regra conceitual:

```text
projectedBalance = currentBalance + pending transactions
```

## Relação Com `effectiveAt`

Transactions pendentes não possuem `effectiveAt`.

Transactions efetivadas devem possuir `effectiveAt`.

Isso permite que o domínio diferencie claramente:

- o que está previsto;
- o que foi realizado;
- quando foi realizado.

## Confirmação

Quando uma transaction pendente é confirmada, ela muda para `EFFECTIVE`.

A partir desse momento, passa a afetar o saldo atual conforme seu type.

Exemplos:

- `INCOME` efetivada aumenta saldo;
- `EXPENSE` efetivada diminui saldo;
- `TRANSFER` efetivada movimenta saldo entre accounts;
- `ADJUSTMENT` efetivada corrige saldo conforme sua direção.

## Pendência Atrasada

Uma pendência atrasada continua sendo `PENDING`.

O fato de a data financeira ter passado não significa que a transaction aconteceu.

Por isso, transaction atrasada:

- não afeta saldo atual;
- pode aparecer em alertas;
- pode aparecer em listagens de atraso;
- pode afetar saldo previsto, se o produto decidir assim.

## Consequência Para O Usuário

O usuário pode cadastrar contas futuras sem bagunçar o saldo real.

Exemplo:

Hoje o usuário tem R$ 1.000 na account.

Ele cadastra uma despesa pendente de R$ 200 para amanhã.

Resultado:

- saldo atual continua R$ 1.000;
- saldo previsto pode mostrar R$ 800;
- a despesa aparece como pendente.

Quando o usuário confirmar o pagamento:

- a transaction vira `EFFECTIVE`;
- o saldo atual passa a considerar a despesa;
- a transaction deixa de ser apenas previsão.

## Regra Central

`PENDING` é planejamento.

`EFFECTIVE` é realidade financeira.

Saldo atual só considera realidade financeira.
