---
area: transactions
feature: core
type: spec-requirements
status: current
related:
  - ../../../../transactions/README.md
  - ../../../../transactions/reference/invariants.md
  - ../../../../transactions/reference/schema.md
  - ../../../../accounts/README.md
  - ../../../../categories/README.md
  - ../../../../database/schema.md
---

# Requirements - Transactions Core

## Objetivo

Implementar o núcleo de `transactions` para registrar lançamentos financeiros simples do usuário autenticado, respeitando as regras já documentadas de accounts, categories, saldo derivado e isolamento multi-tenant.

Esta spec é o contrato inicial antes da implementação do módulo `transactions`.

## Fonte De Contexto

As regras desta spec consolidam:

- [Transactions](../../../../transactions/README.md)
- [Invariants](../../../../transactions/reference/invariants.md)
- [Schema de transactions](../../../../transactions/reference/schema.md)
- [Accounts](../../../../accounts/README.md)
- [Categories](../../../../categories/README.md)
- [Schema do Banco](../../../../database/schema.md)

## Escopo

O core de transactions deve cobrir:

- criação de transaction;
- listagem paginada;
- busca por id;
- atualização de transaction;
- confirmação de transaction pendente;
- delete de transaction;
- tipos `INCOME`, `EXPENSE`, `TRANSFER` e `ADJUSTMENT`;
- status `PENDING` e `EFFECTIVE`;
- persistência de valores monetários em centavos;
- validação de ownership de user, account e category.

## Fora Do Escopo

Esta spec não cobre:

- recorrência;
- parcelamento;
- cartão de crédito, fatura, fechamento ou pagamento de fatura;
- investimento como comportamento de transaction;
- anexos/comprovantes;
- relatórios avançados;
- snapshots de saldo;
- edição avançada de transferências;
- reversão automática de transferências.

## Regras De Negócio

### Ownership

- Toda transaction pertence a um usuário.
- O `userId` sempre vem da sessão autenticada.
- O frontend nunca deve enviar `userId` no body.
- Account, destination account e category usadas por uma transaction devem pertencer ao mesmo usuário autenticado.

### Amount

- Toda transaction deve ter valor maior que zero.
- O valor é absoluto; o sinal financeiro vem do `type` e, em ajuste, do `direction`.
- O banco persiste `amount_cents` como inteiro em centavos.
- O domínio não deve usar `number` de JavaScript para cálculo monetário.

### Status

- `PENDING` representa previsão/planejamento.
- `EFFECTIVE` representa lançamento realizado.
- Transaction `PENDING` não afeta saldo atual.
- Transaction `EFFECTIVE` afeta saldo atual conforme seu `type`.
- Estados como atrasada ou futura são derivados por `status` e `date`, não persistidos.

### Datas

- Toda transaction possui `date`, a data financeira principal.
- Transaction `PENDING` deve ter `effectiveAt` vazio.
- Transaction `EFFECTIVE` deve ter `effectiveAt` preenchido.
- Ao confirmar uma pendência, o sistema deve registrar `effectiveAt`.

### Types

- `INCOME` aumenta o saldo da account quando efetivada.
- `EXPENSE` diminui o saldo da account quando efetivada.
- `TRANSFER` movimenta saldo entre duas accounts do próprio usuário e não é receita nem despesa.
- `ADJUSTMENT` corrige tecnicamente o saldo conforme `direction`.

### Categories

- `INCOME` deve usar category compatível com receita.
- `EXPENSE` deve usar category compatível com despesa.
- `INCOME` e `EXPENSE` devem receber `categoryId` de uma category gerenciável do usuário.
- `TRANSFER` deve usar category técnica de transferência resolvida pelo backend.
- `ADJUSTMENT` deve usar category técnica de ajuste resolvida pelo backend.
- O frontend não deve precisar conhecer nem enviar category técnica para `TRANSFER` ou `ADJUSTMENT`.
- Category arquivada não deve ser usada em novas transactions manuais.
- Category `INVESTMENT` não entra no core de transactions V0.

### Accounts

- Uma transaction deve usar account ativa do usuário.
- `TRANSFER` exige account de origem e account de destino.
- Account de origem e destino de transferência devem ser diferentes.
- Accounts arquivadas não devem receber novas transactions manuais no core.

### Transfer

- Transferência é neutra para receita, despesa e resultado financeiro total.
- Transferência altera os saldos individuais das accounts envolvidas.
- Transferência deve ser atômica.
- Transferência não deve ser deletada pelo usuário na V0.
- Correção de transferência deve ser feita por nova transferência em sentido contrário.

### Adjustment

- Ajuste deve usar `type = ADJUSTMENT`.
- Ajuste deve possuir `direction = INCREASE` ou `DECREASE`.
- Ajuste deve possuir descrição/motivo.
- Ajuste não entra em relatórios comuns de receita e despesa.

### Delete

- Transaction não tem archive.
- Delete pode ser implementado como soft delete.
- Transaction deletada não aparece em listagens comuns.
- Transaction deletada não afeta saldo atual, saldo previsto, pendências ou relatórios comuns.
- Transaction `TRANSFER` não pode ser deletada na V0.

## Requisitos Funcionais

### REQ-001 - Criar transaction

WHEN o usuário autenticado criar uma transaction válida
THE SYSTEM SHALL persistir a transaction vinculada ao usuário, account e category dele.

IF a transaction for `INCOME` or `EXPENSE`
THEN o sistema deve exigir `categoryId` gerenciável e compatível com o type.

IF a transaction for `TRANSFER`
THEN o sistema deve exigir `destinationAccountId`.

IF a transaction for `TRANSFER`
THEN o sistema deve resolver internamente a category técnica de transferência.

IF a transaction não for `TRANSFER`
THEN o sistema deve rejeitar `destinationAccountId`.

IF a transaction for `ADJUSTMENT`
THEN o sistema deve exigir `direction` e descrição/motivo.

IF a transaction for `ADJUSTMENT`
THEN o sistema deve resolver internamente a category técnica de ajuste.

### REQ-002 - Listar transactions

WHEN o usuário autenticado listar transactions
THE SYSTEM SHALL retornar somente transactions não deletadas do usuário autenticado.

THE SYSTEM SHALL permitir paginação estável por `date` e `id`.

THE SYSTEM SHOULD permitir filtros por status, type, account, category e intervalo de datas.

### REQ-003 - Buscar transaction por id

WHEN o usuário autenticado buscar uma transaction por id
THE SYSTEM SHALL retornar a transaction somente se ela pertencer ao usuário.

IF a transaction não existir, estiver deletada ou pertencer a outro usuário
THEN o sistema deve responder como recurso não encontrado.

### REQ-004 - Atualizar transaction

WHEN o usuário atualizar uma transaction
THE SYSTEM SHALL reaplicar as invariantes de type, status, amount, datas, account e category.

IF a transaction for `TRANSFER`
THEN a atualização deve preservar atomicidade entre origem e destino.

IF a atualização tentar produzir combinação inválida de category/type/account/status
THEN o sistema deve rejeitar a operação.

### REQ-005 - Confirmar pending

WHEN o usuário confirmar uma transaction `PENDING`
THE SYSTEM SHALL alterar o status para `EFFECTIVE` e preencher `effectiveAt`.

THE SYSTEM MAY aceitar ajustes de valor, date e campos relevantes no momento da confirmação.

IF a transaction já for `EFFECTIVE`
THEN o sistema deve rejeitar a confirmação repetida.

### REQ-006 - Deletar transaction

WHEN o usuário deletar uma transaction deletável
THE SYSTEM SHALL removê-la do histórico ativo.

IF a transaction for `TRANSFER`
THEN o sistema deve rejeitar o delete na V0.

IF a transaction já estiver deletada ou não pertencer ao usuário
THEN o sistema deve responder como recurso não encontrado.

### REQ-007 - Proteger saldo derivado

WHEN o sistema calcular saldo atual
THE SYSTEM SHALL considerar somente transactions `EFFECTIVE` e não deletadas.

THE SYSTEM SHALL ignorar `PENDING`.

THE SYSTEM SHALL aplicar `INCOME`, `EXPENSE`, `TRANSFER` e `ADJUSTMENT` conforme o impacto financeiro documentado.

## Expectativas De API/Frontend

- O frontend deve tratar `type`, `status` e `direction` como enums do contrato.
- O frontend deve assumir que transactions deletadas somem das listagens comuns.
- O frontend não deve enviar `userId`.
- O contrato público detalhado será documentado em `docs/integrations/transactions/**` depois da aprovação desta spec e implementação dos endpoints.

## Critérios De Aceite

- Requirements, design e tasks desta spec estão aprovados antes da implementação do módulo.
- O schema usado pelo módulo deve bater com [Schema do Banco](../../../../database/schema.md).
- O módulo deve impedir acesso cross-user.
- O módulo deve rejeitar combinations inválidas entre transaction, account e category.
- Tests devem cobrir domínio e use cases principais.
- Swagger e integration docs devem ser atualizados quando os endpoints forem criados.
