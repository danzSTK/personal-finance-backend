---
area: transactions
type: decision
status: draft
related:
  - ../concepts/transaction-deletion.md
  - ../concepts/transaction-status.md
  - ../concepts/transaction-type.md
  - ../reference/invariants.md
---

# Transactions Can Be Deleted

## Decisão

Transactions podem ser excluídas pelo usuário, com exceção de transactions `TRANSFER` na V0.

Transactions não devem ser arquivadas.

No produto, o comportamento deve ser tratado como delete.

## Contexto

Este é um app de finanças pessoais.

O usuário pode errar lançamentos, duplicar registros, cadastrar valor incorreto ou registrar uma transaction na account errada.

Por isso, o domínio deve permitir correção do histórico ativo.

## Motivos

- Dá controle ao usuário sobre o próprio histórico financeiro.
- Permite corrigir cadastros errados.
- Evita criar complexidade de auditoria antes da hora.
- Mantém o produto simples para V0.
- Evita o conceito ambíguo de archive em transactions.

## Delete Vs Archive

Transactions não devem ser arquivadas.

Archive é adequado para cadastros reutilizáveis, como account e category.

Transaction é um lançamento histórico.

Se ela não deve mais existir no histórico ativo, o comportamento correto é delete.

## Implementação Interna

O produto deve tratar a ação como delete.

A persistência pode usar soft delete internamente.

Se soft delete for usado, a transaction excluída deve deixar de participar de:

- saldo atual;
- saldo previsto;
- pendências;
- relatórios comuns;
- listagens comuns.

## Transactions `PENDING`

Transactions pendentes podem ser excluídas.

Ao excluir uma transaction `PENDING`:

- ela deixa de aparecer como pendência;
- deixa de afetar saldo previsto;
- não altera saldo atual, porque pendências já não afetam saldo atual.

## Transactions `EFFECTIVE`

Transactions efetivadas podem ser excluídas, exceto `TRANSFER` na V0.

Ao excluir uma transaction `EFFECTIVE`, seus efeitos devem sair dos cálculos.

Isso pode alterar:

- saldo atual;
- relatórios;
- histórico financeiro;
- leituras derivadas.

A interface pode exigir confirmação mais explícita para esse caso, mas a regra de domínio permite a exclusão.

## Transactions No Passado

Transactions no passado podem ser excluídas.

Como saldo é derivado do histórico, excluir uma transaction passada pode alterar o saldo atual.

Isso é comportamento esperado em um app de finanças pessoais.

## Transferências

Transactions `TRANSFER` não devem ser deletadas pelo usuário na V0.

Transferência representa uma movimentação interna efetivada entre accounts próprias.

Se o usuário quiser desfazer ou corrigir uma transferência, deve criar uma nova transferência no sentido contrário.

Exemplo:

- original: account A -> account B;
- correção: account B -> account A.

Motivo:

- preserva histórico;
- evita apagar movimentação interna já realizada;
- evita inconsistência entre origem e destino;
- mantém a lógica de transferência como evento financeiro neutro, mas histórico.

## Ajustes

Transactions `ADJUSTMENT` podem ser excluídas.

Ao excluir um ajuste, a correção deixa de afetar o saldo.

Isso pode alterar o saldo atual da account.

## Recorrência

Recorrência fica fora da V0.

Quando transactions recorrentes existirem, excluir uma occurrence deverá exigir decisão explícita do usuário.

Possibilidades futuras:

- excluir somente esta occurrence;
- excluir esta e as próximas;
- encerrar a recorrência;
- remover histórico passado apenas com ação avançada e confirmação explícita.

Essas regras devem ser documentadas junto da implementação de recorrência.

## Regra Técnica

O domínio deve impedir delete de transaction `TRANSFER` na V0.

O domínio deve permitir delete de `INCOME`, `EXPENSE` e `ADJUSTMENT`, respeitando ownership e estado ativo da transaction.

Transaction deletada não deve participar de cálculos ou leituras comuns.

## Regra Central

Delete corrige o histórico ativo do usuário.

Archive não existe para transactions.

Transferência não é apagada; é revertida com nova transferência.
