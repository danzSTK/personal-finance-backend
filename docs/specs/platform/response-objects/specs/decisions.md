---
area: platform
feature: response-objects
type: spec-decisions
status: current
related:
  - ./requirements.md
  - ./design.md
---

# Decisions - Response Objects

## DEC-001 - Usar propriedade object

Status: accepted

Decision:
Responses DTO devem declarar o shape usando a propriedade `object`.

Reason:
`object` é curta, explícita e familiar em APIs que precisam diferenciar tipos de payload.

Impact:
DTOs passam a carregar uma string literal extra para consumers validarem o shape recebido.

## DEC-002 - Identifiers por módulo e shape

Status: accepted

Decision:
Identifiers seguem formato segmentado por domínio/shape, como `transaction.list` e `transaction_summary.type`.

Reason:
O formato permite agrupar por módulo e diferenciar variantes sem depender de nomes de classes internas.

Impact:
Novos DTOs devem escolher identifiers estáveis e registrá-los no catálogo centralizado.
