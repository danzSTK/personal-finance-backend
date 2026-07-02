---
area: transactions
feature: core
type: spec-decisions
status: current
related:
  - ./requirements.md
  - ./design.md
  - ../../../../transactions/decisions/transfers-are-neutral.md
  - ../../../../transactions/decisions/adjustments-are-technical-transactions.md
  - ../../../../transactions/decisions/transactions-can-be-deleted.md
---

# Decisions - Transactions Core

## DEC-001 - Transactions terá módulo próprio

Status: accepted

Decision:
`transactions` será implementado como módulo próprio, não como subfluxo de `accounts` ou `categories`.

Reason:
Transaction possui ciclo de vida próprio e é o histórico financeiro central do sistema.

Impact:
O módulo depende de accounts e categories para validação, mas mantém entidade, repository, use cases e controller próprios.

## DEC-002 - Amount será persistido em centavos

Status: accepted

Decision:
Transactions persistem `amount_cents` como inteiro em centavos.

Reason:
Evita imprecisão de `float`/`number` em dinheiro e deixa explícito que o inteiro representa centavos.

Impact:
O domínio e a persistência trabalham em centavos. O contrato HTTP final ainda precisa decidir se o frontend enviará centavos ou string decimal.

## DEC-003 - Transferência será uma linha com origem e destino

Status: accepted

Decision:
`TRANSFER` será persistida em uma única linha com `account_id` como origem e `destination_account_id` como destino.

Reason:
Mantém atomicidade simples na V0 e evita criar dois lançamentos espelhados antes de existir necessidade real.

Impact:
Queries de saldo precisam considerar account como origem e destino. O schema possui índices separados para esses dois papéis.

## DEC-004 - Direction fica genérico, mas exclusivo de adjustment

Status: accepted

Decision:
O campo será chamado `direction`, não `adjustment_direction`.

Reason:
O nome continua curto e permite evolução futura sem migration de renome apenas por nomenclatura.

Impact:
Na V0, constraints e domínio permitem `direction` somente quando `type = ADJUSTMENT`.

## DEC-005 - Delete é comportamento de produto; soft delete é detalhe técnico

Status: accepted

Decision:
Transactions usam delete como linguagem de produto e podem usar `deleted_at` internamente.

Reason:
Archive não combina com histórico financeiro ativo. Soft delete preserva rastreabilidade técnica sem expor archive ao usuário.

Impact:
Listagens e cálculos padrão devem ignorar `deleted_at IS NOT NULL`.

## DEC-006 - Transferência não será deletável na V0

Status: accepted

Decision:
Transaction `TRANSFER` não pode ser deletada pelo usuário na V0.

Reason:
Transferência representa movimentação interna entre duas accounts. Correção deve preservar histórico por transferência inversa.

Impact:
O banco possui check impedindo `deleted_at` em `TRANSFER`, e o domínio deve rejeitar delete antes de chegar ao banco.

## DEC-007 - Core não implementará cache de transactions inicialmente

Status: accepted

Decision:
O repository de transactions começa sem decorator de cache.

Reason:
Transactions impactam saldo, pendências, relatórios e múltiplas listagens. Cache antes de estabilizar invalidação pode criar inconsistência.

Impact:
Performance será tratada primeiro por índices e queries. Cache pode entrar em spec futura.

## DEC-008 - Integration docs vêm depois da aprovação e implementação

Status: accepted

Decision:
`docs/integrations/transactions/**` será criado depois que endpoints, DTOs e erros estiverem definidos.

Reason:
Integration docs são contrato do frontend. Criá-las antes do design HTTP final pode gerar contrato falso.

Impact:
Esta spec guia a implementação; a documentação de integração será task explícita após endpoints.

## DEC-009 - API V0 recebe amountCents

Status: accepted

Decision:
O contrato HTTP V0 de transactions receberá `amountCents` como inteiro positivo.

Reason:
O banco e o domínio já trabalham em centavos. Manter o mesmo formato na API evita parsing decimal ambíguo e deixa explícito o valor real persistido.

Impact:
O frontend deve converter o valor exibido/digitado para centavos antes de chamar a API. Uma camada futura pode aceitar string decimal se isso melhorar ergonomia sem alterar o domínio.

## DEC-010 - Categories técnicas são resolvidas pelo backend

Status: accepted

Decision:
`TRANSFER` e `ADJUSTMENT` não exigem `categoryId` no contrato público. O backend resolve a category técnica ativa do usuário conforme o `type`.

Reason:
Categories técnicas não aparecem nas rotas de gestão do frontend e não devem vazar como detalhe de implementação. Isso mantém o contrato público menor e evita que o frontend precise conhecer IDs internos de categories de sistema.

Impact:
`categoryId` continua obrigatório para `INCOME` e `EXPENSE`. Para `TRANSFER` e `ADJUSTMENT`, qualquer `categoryId` enviado pode ser ignorado em favor da category técnica correta.

## DEC-011 - Constraints de ADJUSTMENT devem ser null-safe

Status: accepted

Decision:
As constraints de banco para `ADJUSTMENT` devem exigir `direction IS NOT NULL` e `description IS NOT NULL` antes de validar enum/tamanho.

Reason:
No PostgreSQL, `CHECK` aceita expressões que avaliam para `UNKNOWN`. Sem checar `IS NOT NULL`, inserts diretos poderiam persistir ajustes sem direção ou motivo.

Impact:
`CHK_transactions_direction` e `CHK_transactions_adjustment_description` foram recriadas em migration incremental e alinhadas ao contrato de domínio.
