---
area: platform
feature: response-objects
type: spec-design
status: approved
related:
  - ./requirements.md
  - ./decisions.md
---

# Design - Response Objects

## Arquitetura

Criar catálogo comum em:

```text
api/src/common/models/constants/response-object.constants.ts
```

Exportar pelo barrel de constants.

## Contrato

Usar a propriedade:

```json
{
  "object": "transaction.list"
}
```

O nome da propriedade é sempre `object`.

## Identifiers Iniciais

```text
transaction.list
transaction_summary.type
transaction_summary.overview
account.list
```

`account.list` entra no catálogo como valor reservado para padronização próxima, mesmo que a aplicação inicial desta spec seja em transactions.

## DTOs Dinâmicos

Cada shape dinâmico deve ter DTO próprio:

- `ListTransactionsTypeSummaryDto` usa `transaction_summary.type`;
- `ListTransactionsGroupedSummaryDto` usa `transaction_summary.overview`;
- `ListTransactionsResponseDto` usa `transaction.list`.

## Documentação

Atualizar:

- `AGENTS.md`;
- `docs/platform/response-objects.md`;
- `docs/platform/README.md`;
- `docs/integrations/response-objects.md`;
- `docs/integrations/README.md`;
- `docs/integrations/transactions/list-transactions.md`.

## Testes

Atualizar teste de use case/DTO quando o shape passar pelo mapper.

Rodar build e lint focado.
