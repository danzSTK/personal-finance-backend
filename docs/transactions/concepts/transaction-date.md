---
area: transactions
type: concept
status: draft
related:
  - ./transaction.md
  - ./transaction-status.md
  - ../../platform/dates-and-times.md
---

# Transaction Date

Transaction date representa as datas financeiras relevantes de uma transaction.

Na V0, uma transaction deve separar a data financeira do lançamento da data em que ele foi efetivado.

## Objetivo

O objetivo é diferenciar previsão, competência financeira e realização real.

Uma transaction pode ser planejada para uma data, mas acontecer em outra.

Exemplo:

O usuário cadastrou uma conta para o dia 15, mas pagou no dia 3.

Nesse caso:

- a data financeira planejada era dia 15;
- a efetivação aconteceu dia 3.

## `date`

`date` representa a data financeira principal da transaction.

Ela indica quando o lançamento aconteceu ou quando está previsto para acontecer.

`date` é um `DateOnly`: uma data civil no formato `YYYY-MM-DD`, sem hora e sem timezone.

Ela não deve ser convertida para `Date` JavaScript dentro da aplicação. `2026-06-28` significa o dia `2026-06-28`, não o instante `2026-06-28T00:00:00.000Z`.

Exemplos:

- data da compra;
- data do pagamento previsto;
- data do recebimento previsto;
- data da transferência planejada;
- data usada para ordenar o lançamento no histórico financeiro.

## `effectiveAt`

`effectiveAt` representa quando a transaction foi efetivada.

Ela indica quando o lançamento deixou de ser previsão e passou a ser realidade financeira.

`effectiveAt` é um `Instant`: um momento exato no tempo, salvo como `timestamptz` e exposto como ISO UTC.

Regra:

- transaction `PENDING` deve ter `effectiveAt` vazio;
- transaction `EFFECTIVE` deve ter `effectiveAt` preenchido;
- ao confirmar uma transaction pendente, o sistema deve preencher `effectiveAt`;
- uma transaction criada diretamente como efetivada já deve nascer com `effectiveAt`.

## Diferença Entre `date` E `effectiveAt`

`date` responde:

“Qual é a data financeira desse lançamento?”

`effectiveAt` responde:

“Quando esse lançamento foi confirmado como realizado?”

Em muitos casos, as duas datas serão iguais.

Exemplo:

O usuário pagou uma despesa hoje e cadastrou como já paga.

- `date`: hoje;
- `effectiveAt`: hoje.

Em outros casos, elas podem ser diferentes.

Exemplo:

O usuário cadastrou uma conta para o dia 15, mas pagou no dia 3.

- `date`: dia 3 ou dia 15, dependendo da decisão final de edição na confirmação;
- `effectiveAt`: dia 3.

## Confirmação De Pendência

Durante a confirmação de uma transaction pendente, o usuário pode ajustar a data financeira para refletir o que realmente aconteceu.

Exemplo:

Uma despesa estava prevista para o dia 15, mas foi paga no dia 3.

Na confirmação, o usuário pode alterar `date` para dia 3.

Nesse caso, a V0 não precisa manter a data planejada original separadamente.

A transaction passa a refletir a realidade confirmada.

## Data Planejada Original

Na V0, não é necessário armazenar uma data planejada original separada.

Motivo:

- reduz complexidade;
- evita transformar transaction em histórico de alteração;
- atende o objetivo principal de refletir a realidade financeira atual;
- histórico/auditoria pode ser criado no futuro, se necessário.

Se no futuro o produto precisar comparar previsto vs realizado, pode ser criado um campo próprio ou uma estrutura de planejamento separada.

## Schema Atual

O schema legado possui apenas:

```text
transactions.date
```

Para suportar a regra da V0, o schema final deve adicionar uma data de efetivação.

Nome sugerido:

```text
transactions.effective_at
```

## Regra Central

Na V0, transaction deve ter duas datas conceituais:

- `date`: data financeira principal;
- `effectiveAt`: data/momento em que a transaction foi efetivada.

Transactions pendentes não possuem `effectiveAt`.

Transactions efetivadas devem possuir `effectiveAt`.
