---
area: transactions
type: concept
status: draft
related:
  - ./transaction-type.md
  - ./transaction-status.md
  - ./transaction-date.md
  - ./transaction-amount.md
  - ../../accounts/concepts/account.md
  - ../../categories/README.md
---

# Transaction

Uma transaction representa um lançamento financeiro do usuário.

Ela registra algo que aconteceu, vai acontecer ou precisa ser acompanhado dentro da vida financeira do usuário.

O sistema não movimenta dinheiro de verdade. Ele apenas registra, organiza, calcula e projeta movimentações financeiras.

## Modelo Mental

O cadastro da transaction deve ser simples para o usuário.

O usuário informa o que aconteceu ou o que está previsto para acontecer. A regra de domínio decide como esse lançamento afeta saldo, histórico, pendências e relatórios.

## O Que Transaction Não É

Transaction não deve representar tudo.

Não use transaction para representar:

- account, porque account é o lugar lógico onde o usuário acompanha dinheiro;
- category, porque category classifica a semântica financeira do lançamento;
- regra recorrente, porque recorrência é uma regra que pode gerar transactions;
- relatório, porque relatório é leitura derivada do histórico;
- fatura de cartão, porque fatura precisa de regras próprias quando o módulo de cartão for consolidado;
- anexo/comprovante, porque isso deve ser tratado por assets quando existir.

## Segurança

Toda transaction pertence a um `userId`.

O `userId` deve vir da sessão autenticada. O frontend nunca deve enviar `userId` no body.

Qualquer `accountId` e `categoryId` usados na transaction precisam pertencer ao mesmo usuário autenticado.

## Regra Central

Uma transaction deve preservar histórico financeiro sem exigir que o usuário entenda contabilidade.

A regra por trás pode ser mais rigorosa, mas o cadastro deve continuar simples.
