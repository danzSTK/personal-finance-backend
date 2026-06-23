---
area: transactions
type: decision
status: draft
related:
  - ../concepts/transaction-amount.md
  - ../concepts/transaction-type.md
  - ../reference/invariants.md
  - ../../database/schema.md
---

# Transaction Amount Is Positive

## Decisão

Toda transaction deve armazenar `amount` como valor positivo.

O sinal financeiro não deve vir de número negativo.

A direção financeira deve ser definida pelo domínio, principalmente pelo `TransactionType` e por campos explícitos quando necessário.

## Contexto

Em sistemas financeiros simples, é comum representar entradas como valores positivos e saídas como valores negativos.

Essa abordagem parece prática no começo, mas cria ambiguidade conforme o domínio cresce.

Como transactions podem representar income, expense, transfer e adjustment, o número sozinho não deve carregar a semântica financeira.

## Motivos

- Evita ambiguidade na leitura do histórico.
- Impede combinações inválidas, como expense negativo ou income negativo.
- Mantém consistência entre `INCOME`, `EXPENSE`, `TRANSFER` e `ADJUSTMENT`.
- Simplifica validação de entrada.
- Facilita relatórios e cálculos derivados.
- Alinha o domínio com a constraint atual do banco.
- Deixa a intenção financeira explícita no type e não escondida no sinal do número.

## Consequências

Uma transaction `EXPENSE` de R$ 100 deve ser salva como:

```text
type = EXPENSE
amount = 100
```

E não como:

```text
type = EXPENSE
amount = -100
```

Uma transaction `INCOME` de R$ 100 deve ser salva como:

```text
type = INCOME
amount = 100
```

Transferências devem continuar usando `amount` positivo.

A saída da account de origem e a entrada na account de destino devem ser decididas pela regra de transferência, não por valor negativo.

Ajustes também devem manter `amount` positivo.

A direção do ajuste deve ser definida por modelagem explícita, não pelo sinal do número.

## Regra Técnica

O domínio deve rejeitar qualquer transaction com `amount <= 0`.

O banco também deve manter constraint equivalente.

Regra esperada:

```text
amount > 0
```

A interpretação financeira deve vir do comportamento da transaction, não do sinal de `amount`.

## Relação Com Schema Atual

O schema atual já possui constraint para `amount > 0`.

Essa decisão confirma que essa constraint está alinhada ao domínio e deve permanecer no schema final.

## Regra Central

`amount` é sempre valor absoluto.

O domínio decide se esse valor entra, sai, transfere ou ajusta.
