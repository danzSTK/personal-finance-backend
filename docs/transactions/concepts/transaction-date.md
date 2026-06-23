---
area: transactions
type: concept
status: draft
related:
  - ./transaction.md
  - ./transaction-status.md
---

# Transaction Date

Transaction date representa a data financeira do lançamento.

Ela pode indicar quando o lançamento aconteceu ou quando ele está previsto para acontecer.

## Campo Atual

O schema legado possui o campo:

```text
transactions.date
```

Na V0, a regra final ainda precisa decidir se apenas `date` é suficiente ou se será necessário separar data financeira e data de efetivação.

## Possível Modelo Futuro

Possíveis campos:

- `date`: data financeira do lançamento;
- `effectiveAt`: momento em que o lançamento foi confirmado como realizado.

## Decisão Pendente

Ainda falta validar se a V0 terá somente `date` ou se já deve nascer com uma data de confirmação separada.
