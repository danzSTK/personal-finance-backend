---
area: platform
type: contract
status: current
related:
  - ../integrations/response-objects.md
---

# Response Objects

Response objects declaram o shape do payload retornado usando a propriedade `object`.

Essa regra existe para evitar ambiguidade em consumers, especialmente quando um endpoint pode retornar mais de um shape.

## Regra

Todo response DTO novo deve declarar:

```json
{
  "object": "module.shape"
}
```

O valor de `object` deve vir do catálogo centralizado:

```text
api/src/common/models/constants/response-object.constants.ts
```

## Naming

Use identifiers estáveis separados por módulo/shape:

- `transaction.list`
- `transaction_summary.type`
- `transaction_summary.overview`
- `account.list`

O identifier descreve o shape, não uma classe TypeScript interna.

## Dynamic Responses

Quando um endpoint puder retornar shapes diferentes, cada shape deve ter DTO próprio e `object` próprio.

Exemplo:

- summary simples de transactions: `transaction_summary.type`;
- summary agrupado de transactions: `transaction_summary.overview`.

Consumers podem usar `object` para fazer narrowing seguro antes de acessar propriedades específicas.
