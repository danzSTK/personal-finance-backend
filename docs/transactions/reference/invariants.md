---
area: transactions
type: reference
status: draft
related:
  - ../concepts/transaction.md
  - ../concepts/transaction-type.md
  - ../concepts/transaction-status.md
  - ../concepts/transaction-date.md
  - ../concepts/transaction-amount.md
  - ../concepts/transaction-deletion.md
  - ../decisions/transaction-amount-is-positive.md
  - ../decisions/pending-transactions-do-not-affect-current-balance.md
  - ../decisions/transfers-are-neutral.md
  - ../decisions/adjustments-are-technical-transactions.md
  - ../decisions/transactions-can-be-deleted.md
---

# Invariants

Invariants são regras que precisam ser verdadeiras em qualquer ponto do domínio de transactions.

Elas não dependem de controller, endpoint, DTO ou caso de uso específico.

## Ownership

- Toda transaction pertence a um `userId`.
- `userId` sempre vem da sessão autenticada.
- `userId` nunca deve vir do body da requisição.
- Uma transaction não pode conectar dados de usuários diferentes.
- Toda account usada por uma transaction deve pertencer ao mesmo usuário da transaction.
- Toda category usada por uma transaction deve pertencer ao mesmo usuário da transaction.

## Amount

- Toda transaction deve ter `amount > 0`.
- `amount` sempre representa valor absoluto.
- O sinal financeiro não deve vir de número negativo.
- O domínio deve rejeitar `amount <= 0`.
- O banco deve manter constraint equivalente para proteger `amount > 0`.

## Type

- O domínio de transactions inicia com os types `INCOME`, `EXPENSE`, `TRANSFER` e `ADJUSTMENT`.
- `INCOME` representa entrada de dinheiro.
- `EXPENSE` representa saída de dinheiro.
- `TRANSFER` representa movimentação entre accounts próprias.
- `ADJUSTMENT` representa correção técnica de saldo.
- Novos types só devem ser adicionados quando houver regra de negócio clara.

## Status

- O domínio de transactions inicia com os status `PENDING` e `EFFECTIVE`.
- `PENDING` representa planejamento ou previsão.
- `EFFECTIVE` representa realidade financeira.
- Uma transaction `PENDING` não afeta saldo atual.
- Uma transaction `EFFECTIVE` afeta saldo atual conforme seu type.
- Estados como pendente futura ou pendente atrasada devem ser derivados por data, não persistidos como status próprios na V0.

## Dates

- Toda transaction deve ter `date`.
- `date` representa a data financeira principal da transaction.
- Transaction `PENDING` deve ter `effectiveAt` vazio.
- Transaction `EFFECTIVE` deve ter `effectiveAt` preenchido.
- Ao confirmar uma transaction pendente, o sistema deve registrar `effectiveAt`.
- Uma transaction criada diretamente como `EFFECTIVE` deve nascer com `effectiveAt`.
- Na V0, a data planejada original não precisa ser preservada separadamente depois da confirmação.

## Category

- Toda transaction deve usar uma category compatível com seu type.
- Category arquivada não deve ser usada em novas transactions manuais.
- `INCOME` deve usar category compatível com receita.
- `EXPENSE` deve usar category compatível com despesa.
- `TRANSFER` deve usar semântica técnica de transferência.
- `ADJUSTMENT` deve usar category técnica `ADJUSTMENT`.
- O domínio deve impedir combinações incompatíveis entre transaction type e category.

## Balance Impact

- Transactions `PENDING` não afetam saldo atual.
- Transactions `EFFECTIVE` afetam saldo atual conforme seu type.
- `INCOME` efetivada aumenta saldo da account.
- `EXPENSE` efetivada diminui saldo da account.
- `TRANSFER` efetivada movimenta saldo entre accounts próprias.
- `ADJUSTMENT` efetivada corrige saldo conforme sua direction.

## Transfer

- Transferência entre accounts próprias não é receita.
- Transferência entre accounts próprias não é despesa.
- Transferência não altera o resultado financeiro total do usuário.
- Transferência pode alterar os saldos individuais das accounts envolvidas.
- Transferência não deve entrar em relatórios comuns de receita ou despesa.
- Transferência deve ser atômica.
- Account de origem e account de destino devem pertencer ao mesmo usuário.
- Account de origem e account de destino devem ser diferentes.
- Transaction `TRANSFER` não deve ser deletada pelo usuário na V0.
- Correção de transferência deve ser feita por nova transferência no sentido contrário.
- Taxa de transferência deve ser registrada como transaction `EXPENSE` separada.

## Adjustment

- Ajuste de saldo deve usar type `ADJUSTMENT`.
- Ajuste de saldo deve usar category técnica `ADJUSTMENT`.
- Ajuste de saldo não é receita comum.
- Ajuste de saldo não é despesa comum.
- Ajuste de saldo deve exigir motivo ou observação.
- Ajuste de saldo deve possuir `direction`.
- `direction` é exclusivo de transactions `ADJUSTMENT`.
- Se `type = ADJUSTMENT`, `direction` é obrigatório.
- Se `type != ADJUSTMENT`, `direction` deve ser vazio.
- Valores possíveis de `direction` na V0: `INCREASE` e `DECREASE`.

## Deletion

- Transaction não deve ser arquivada.
- Transaction pode ser deletada pelo usuário, exceto `TRANSFER` na V0.
- Transaction deletada não deve aparecer em listagens comuns.
- Transaction deletada não deve afetar saldo atual.
- Transaction deletada não deve afetar saldo previsto.
- Transaction deletada não deve aparecer como pendência.
- Transaction deletada não deve entrar em relatórios comuns.
- Transaction `PENDING` deletada deixa de afetar projeções.
- Transaction `EFFECTIVE` deletada tem seus efeitos removidos dos cálculos.
- Deletar transaction passada pode alterar saldo atual.
- Delete pode ser implementado como soft delete internamente, mas o comportamento de produto continua sendo delete.

## Reports

- `TRANSFER` não deve entrar em relatórios comuns de receita ou despesa.
- `ADJUSTMENT` não deve entrar em relatórios comuns de receita ou despesa.
- Relatórios podem criar leituras específicas para transferências e ajustes, mas elas não devem poluir renda, gastos ou resultado financeiro comum.

## Regra Central

Transaction registra histórico financeiro.

O domínio deve proteger ownership, amount positivo, status coerente, datas coerentes, type compatível, category compatível, delete coerente e impacto financeiro correto.
