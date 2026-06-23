---
area: accounts
type: reference
status: open
related:
  - ../concepts/account-balance.md
  - ../flows/transfer-between-accounts.md
---

# Open Questions

## Saldo Negativo

Ainda está aberto se uma account pode ficar com saldo negativo.

Possibilidades:

- Permitir saldo negativo e tratar como dado real.
- Bloquear saídas que deixem a account negativa.
- Permitir por tipo de account, por exemplo `BANK` sim e `CASH` não.

## Snapshot De Saldo

Snapshots não entram na V0, mas podem ser necessários se o cálculo por histórico ficar caro.

## Correções Depois Da Primeira Movimentação

A direção atual é corrigir saldo por transações ou ajustes, mas ainda falta definir a experiência exata de UI e auditoria para esses ajustes.

## CREDIT_CARD E INVESTMENT

Os tipos existem, mas ainda precisam de regras próprias antes de virarem experiência principal.
