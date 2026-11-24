---
area: platform
type: index
status: current
last_reviewed: 2026-10-30
related:
  - ./response-objects.md
  - ../../integrations/response-objects.md
---

# Objetos de Resposta da API (Discriminadores)

Este contexto documenta o padrão da Danfy para identificar de forma explícita e determinística o formato dos dados retornados para os clientes através do discriminador `object`.

## Mapa do Contexto

- [Response Objects](./response-objects.md) — Regra de identificadores estáveis `object` em DTOs, convenção de nomenclatura por módulo/recurso e proibição de strings mágicas.

## Responsabilidade da Pasta

Consulte esta pasta quando a tarefa envolver:
- Criação de novos Response DTOs na camada de apresentação (`presentation/dto/`).
- Definição de constantes de discriminador em `@/common/models/constants/response-object.constants.ts`.
- Contratos de serialização polimórfica para o frontend.
