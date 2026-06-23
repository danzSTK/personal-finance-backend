---
area: transactions
type: index
status: planned
related:
  - ../accounts/README.md
  - ../categories/README.md
  - ../database/schema.md
---

# Transactions

Este diretório documenta as regras de negócio, decisões arquiteturais e fluxos internos do domínio de transactions.

Na V0, `transactions` ainda nasce como documentação de domínio planejada. O schema legado já existe no banco, mas as regras finais serão consolidadas arquivo por arquivo antes da implementação completa do módulo.

## Mapa

### Conceitos

- [Transaction](./concepts/transaction.md)
- [Transaction type](./concepts/transaction-type.md)
- [Transaction status](./concepts/transaction-status.md)
- [Transaction date](./concepts/transaction-date.md)
- [Transaction amount](./concepts/transaction-amount.md)

### Fluxos

- [Create transaction](./flows/create-transaction.md)
- [Update transaction](./flows/update-transaction.md)
- [Archive transaction](./flows/archive-transaction.md)
- [Delete transaction](./flows/delete-transaction.md)
- [Confirm pending transaction](./flows/confirm-pending-transaction.md)
- [Balance adjustment](./flows/balance-adjustment.md)

### Decisões

- [Transaction amount is positive](./decisions/transaction-amount-is-positive.md)
- [Pending transactions do not affect current balance](./decisions/pending-transactions-do-not-affect-current-balance.md)
- [Transfers are neutral](./decisions/transfers-are-neutral.md)
- [Adjustments are technical transactions](./decisions/adjustments-are-technical-transactions.md)

### Referência

- [Invariants](./reference/invariants.md)
- [Schema](./reference/schema.md)

## Estado Atual

Implementado/legado:

- tabela `transactions` no schema atual;
- vínculo com `users`, `accounts` e `categories`;
- `amount > 0` protegido por constraint;
- soft delete legado por `is_active` e `deactivated_at`.

Planejado:

- consolidar entidade de domínio própria;
- separar claramente tipo, status, datas e impacto financeiro;
- definir como pendências, transferências e ajustes entram no cálculo de saldo;
- criar integração HTTP somente depois da regra de domínio validada.

## Limite Desta Documentação

Este diretório não deve documentar regras profundas de `accounts`, `categories`, cartão de crédito, faturas, recorrência, investimentos ou relatórios avançados.

Quando uma transaction depender desses domínios, esta documentação deve referenciar a documentação dona da regra em vez de duplicá-la.
