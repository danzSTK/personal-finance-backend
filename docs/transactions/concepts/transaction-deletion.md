---
area: transactions
type: concept
status: draft
related:
  - ./transaction.md
  - ./transaction-status.md
  - ../decisions/transactions-can-be-deleted.md
  - ../reference/invariants.md
---

# Transaction Deletion

Transaction deletion representa a exclusão de um lançamento financeiro do histórico ativo do usuário.

No produto, o comportamento deve ser chamado de delete.

Transactions não devem ter conceito de archive.

## Objetivo

Permitir que o usuário corrija lançamentos criados por engano, duplicados ou registrados com dados errados.

Como o app é de finanças pessoais, o usuário deve ter liberdade para excluir lançamentos manuais quando necessário.

## Delete Não É Archive

Archive faz sentido para cadastros que deixam de ser usados, como account e category.

Transaction é diferente.

Ela representa o próprio histórico financeiro.

Arquivar uma transaction criaria ambiguidade:

- ainda afeta saldo?
- ainda aparece em relatórios?
- ainda aparece em histórico?
- some apenas da tela principal?

Por isso, na V0, transaction não deve ser arquivada.

## Comportamento De Produto

Quando uma transaction é excluída, ela deixa de participar das leituras comuns do sistema.

Regra:

- não aparece em listagens comuns;
- não afeta saldo atual;
- não afeta saldo previsto;
- não aparece como pendência;
- não entra em relatórios comuns.

## Implementação Interna

O comportamento de produto é delete.

A implementação pode usar soft delete internamente para preservar rastreabilidade técnica.

O schema legado já possui `is_active` e `deactivated_at`.

Mesmo usando soft delete, a transaction excluída deve ser tratada como removida do histórico ativo do usuário.

## Transactions Efetivadas

Transactions `EFFECTIVE` podem ser excluídas.

Ao excluir uma transaction efetivada, seus efeitos saem dos cálculos.

Isso pode alterar:

- saldo atual;
- relatórios;
- histórico financeiro;
- projeções derivadas.

## Transactions Pendentes

Transactions `PENDING` podem ser excluídas.

Ao excluir uma transaction pendente, ela deixa de afetar projeções, pendências e saldos previstos.

Como pendência não afeta saldo atual, excluir uma pendência não deve alterar saldo atual.

## Transferências

Transactions `TRANSFER` não devem ser deletadas pelo usuário na V0.

Uma transferência representa uma movimentação efetiva entre accounts próprias.

Se o usuário quiser desfazer uma transferência, deve registrar uma nova transferência no sentido contrário.

Exemplo:

- transferência original: account A -> account B;
- correção: nova transferência account B -> account A.

Isso preserva histórico e evita apagar uma movimentação interna já realizada.

## Recorrência

Recorrência fica fora da V0.

Quando existir recorrência, excluir uma occurrence deve exigir uma decisão explícita do usuário.

Possibilidades futuras:

- excluir somente esta occurrence;
- excluir esta e as próximas;
- encerrar a recorrência;
- remover histórico passado apenas com ação avançada e confirmação explícita.

Essas regras devem ser documentadas quando o módulo de recorrência for implementado.

## Regra Central

Transaction pode ser excluída para corrigir o histórico ativo do usuário.

Transaction não é arquivada.

Transferência não deve ser deletada; deve ser revertida por nova transferência.
