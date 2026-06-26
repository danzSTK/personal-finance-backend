---
area: transactions
feature: list-filters-summary
type: spec-decisions
status: approved
related:
  - ./requirements.md
  - ./design.md
  - ../../../../transactions/decisions/pending-transactions-do-not-affect-current-balance.md
  - ../../../../transactions/decisions/transfers-are-neutral.md
---

# Decisions - Transaction List Filters And Summary

## DEC-001 - Summary ignora paginação

Status: accepted

Decision:
`summary` será calculado com os mesmos filtros da requisição, mas sem aplicar `page` e `limit`.

Reason:
O frontend normalmente precisa totalizar a consulta filtrada inteira, enquanto `data` representa apenas a página atual. Se o summary fosse da página, ele mudaria ao paginar e perderia utilidade como resumo do filtro ativo.

Impact:
`summary` pode representar transactions que não estão no array `data` da página atual.

## DEC-002 - Sort V0 será apenas por date

Status: accepted

Decision:
`sort` aceitará somente `date:desc` e `date:asc` nesta versão.

Reason:
A listagem atual já é baseada em `date`, existe índice para usuário/data/id, e `date` é a ordenação natural do histórico financeiro. Outros sorts, como valor ou criação, podem exigir novos índices e decisões de produto.

Impact:
O frontend ganha controle entre leitura mais recente primeiro e leitura cronológica, sem ampliar demais o contrato inicial.

## DEC-003 - Transfer é neutra sem accountId e direcional com accountId

Status: accepted

Decision:
No `summary`, `TRANSFER` vale `0` quando a consulta não tem `accountId`. Quando a consulta tem `accountId`, a transferência soma para destino e subtrai para origem.

Reason:
Transferência não altera o total financeiro do usuário, mas altera o saldo individual das accounts envolvidas. O filtro `accountId` muda a perspectiva do summary para a account participante.

Impact:
`GET /transactions?type=TRANSFER` sem `accountId` pode retornar transactions em `data` com `summary.totalCents = 0`. Com `accountId`, o summary mostra o impacto na account filtrada.

## DEC-004 - Summary usa centavos assinados

Status: superseded

Decision:
`pendingCents`, `effectiveCents` e `totalCents` serão inteiros em centavos assinados.

Reason:
Transactions armazenam `amount_cents` como valor absoluto. O summary precisa aplicar o sinal financeiro derivado de `type`, `direction` e perspectiva de account, mantendo a unidade monetária já usada pelo contrato HTTP.

Impact:
Os campos de summary podem ser negativos. O frontend deve formatar valores negativos como saída/redução conforme a tela.

Superseded by:
[DEC-005 - Summary separa valores absolutos por type e deltas de balance](#dec-005---summary-separa-valores-absolutos-por-type-e-deltas-de-balance)

## DEC-005 - Summary separa valores absolutos por type e deltas de balance

Status: accepted

Decision:
`income` e `expense` retornam valores positivos ou zero. Deltas de saldo ficam em `summary.balance.pendingDeltaCents` e `summary.balance.effectiveDeltaCents`.

Reason:
O contrato fica mais claro para o frontend: blocos de receita/despesa respondem quanto há de cada tipo, enquanto `balance` responde o impacto líquido.

Impact:
`summary.pendingCents`, `summary.effectiveCents` e `summary.totalCents` só aparecem no modelo simples com `type` explícito e também são positivos. O modelo agrupado sem `type` usa `income`, `expense` e `balance`.

## DEC-006 - Type ausente lista somente income e expense

Status: accepted

Decision:
Quando `type` não for enviado em `GET /transactions`, a listagem padrão retorna somente transactions `INCOME` e `EXPENSE`.

Reason:
A tela principal de receitas/despesas não deve misturar transferências e ajustes técnicos no histórico padrão.

Impact:
`TRANSFER` e `ADJUSTMENT` continuam acessíveis por `type` explícito, mas deixam de aparecer na listagem padrão sem type.
