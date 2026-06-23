---
area: transactions
type: reference
status: open
related:
  - ../README.md
  - ../../accounts/reference/open-questions.md
---

# Open Questions

## Status

Ainda falta decidir o enum final de status.

Possibilidades:

- `PENDING` e `EFFECTIVE`;
- `PENDING` e `CONFIRMED`;
- outro nome mais alinhado ao domínio.

## Datas

Ainda falta decidir se a V0 terá apenas `date` ou também um campo separado para confirmação/efetivação.

## Ajuste De Saldo

Ainda falta decidir como representar a direção do ajuste mantendo `amount > 0`.

## Transferências

Ainda falta decidir a modelagem persistida de transferência:

- uma transaction composta;
- duas transactions vinculadas;
- outra estrutura dedicada.

## Cartão De Crédito

`CREDIT_CARD` existe em account type, mas as regras de fatura, pagamento, parcelamento e fechamento ainda não pertencem à V0 de transactions.

## Recorrência

Recorrência deve ser uma regra que gera transactions, não uma transaction única.

Ainda falta decidir quando esse módulo será criado.

## Relatórios

Relatórios devem ser derivados do histórico, mas a regra final de agregação ainda não pertence ao esqueleto inicial de transactions.
