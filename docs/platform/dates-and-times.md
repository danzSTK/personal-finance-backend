---
area: platform
type: reference
status: current
related:
  - ../database/schema.md
  - ../integrations/date-and-time.md
  - ../transactions/concepts/transaction-date.md
---

# Datas e Instantes

A plataforma separa dois conceitos que não devem ser misturados:

- `DateOnly`: data civil, sem hora e sem timezone.
- `Instant`: momento exato no tempo, salvo e trafegado em UTC.

Essa separação existe para evitar bugs de fuso horário, especialmente quando uma data civil como `2026-06-28` é convertida para `Date` JavaScript e vira `2026-06-27` em ambientes `UTC-03`.

## DateOnly

`DateOnly` representa uma data do calendário.

Formato:

```text
YYYY-MM-DD
```

Exemplos:

- `transactions.date`
- `dateFrom`
- `dateTo`
- `projectedUntil`

Regras:

- Deve ser tratado como string literal validada.
- Não deve ser convertido para `Date` JavaScript.
- Não possui hora.
- Não possui timezone.
- Deve ser persistido em coluna PostgreSQL `date`.
- Ao salvar em `date`, a aplicação deve enviar a string `YYYY-MM-DD`, não um objeto `Date`.
- Ao ler do banco, deve continuar como `YYYY-MM-DD` no contrato da aplicação e da API.

`2026-06-28` significa literalmente o dia `2026-06-28`.

Não significa:

```text
2026-06-28T00:00:00.000Z
```

Esse segundo valor já é um `Instant`, não uma data civil.

## Instant

`Instant` representa um ponto exato na linha do tempo.

Formato no contrato HTTP:

```text
ISO 8601 UTC
```

Exemplo:

```text
2026-06-25T21:01:53.009Z
```

Exemplos na plataforma:

- `createdAt`
- `updatedAt`
- `effectiveAt`
- `deletedAt`
- `archivedAt`
- `occurredAt`
- `publishedAt`

Regras:

- Deve ser salvo em PostgreSQL como `timestamptz`.
- Pode ser representado como `Date` no JavaScript/TypeScript.
- Backend e banco devem tratar o valor em UTC.
- Respostas HTTP devem enviar ISO UTC.
- O frontend pode converter para timezone local do usuário quando for exibir hora.

Exemplo:

Se o usuário em Fortaleza cria algo às 08:00, o instante real pode ser salvo e trafegado como `11:00Z`.

Para o backend, o instante é `11:00Z`.

Para o usuário em Fortaleza, o frontend pode exibir `08:00`.

Para outro usuário em outro fuso, o mesmo instante pode aparecer como outro horário local. Isso é correto.

## Regra de Nomenclatura

Campos que terminam em `At` normalmente são `Instant`.

Exemplos:

- `createdAt`
- `updatedAt`
- `effectiveAt`

Campos como `date`, `dateFrom`, `dateTo` e `projectedUntil` normalmente são `DateOnly`.

## Anti-padrões

Não fazer:

```ts
new Date('2026-06-28')
new Date('2026-06-28T00:00:00.000Z')
date.toISOString().slice(0, 10)
```

para representar ou serializar `DateOnly`.

Essas operações transformam uma data civil em instante e podem deslocar o dia conforme o timezone do processo.

## Regra Para Novas Features

Antes de adicionar um campo temporal, decidir:

1. É uma data civil?
2. É um instante?

Se for data civil, usar `DateOnly`.

Se for momento exato no tempo, usar `Instant`.

Essa decisão deve aparecer na spec da feature quando o campo fizer parte do domínio.
