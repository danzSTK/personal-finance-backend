---
area: platform
feature: response-objects
type: spec-requirements
status: approved
related:
  - ../../../../platform/README.md
  - ../../../../integrations/README.md
  - ../../../../integrations/transactions/list-transactions.md
---

# Requirements - Response Objects

## Objetivo

Padronizar uma propriedade `object` em responses HTTP para declarar explicitamente o shape retornado.

Essa propriedade ajuda consumers a diferenciar responses com shapes dinâmicos e evita que o frontend trate um payload como se fosse outro.

## Escopo

Esta spec cobre:

- catálogo centralizado de identifiers de response object;
- propriedade `object` em DTOs de response;
- documentação técnica em `docs/platform`;
- documentação de integração em `docs/integrations`;
- aplicação inicial em `GET /transactions`.

## Regras

- Todo response DTO novo deve declarar `object`.
- `object` deve ser string literal centralizada em catálogo comum.
- O valor deve indicar o shape de retorno, não apenas o endpoint.
- Keys devem ser segmentadas por módulo/domínio, como `transaction.list`, `transaction_summary.type` e `account.list`.
- Responses dinâmicos devem usar DTOs próprios por shape, cada um com seu `object`.

## Requisitos Funcionais

### REQ-001 - Declarar object no response

WHEN um endpoint retornar um objeto JSON
THE SYSTEM SHALL incluir uma propriedade `object` quando houver DTO de response.

### REQ-002 - Diferenciar shapes dinâmicos

WHEN um response puder retornar mais de um shape
THE SYSTEM SHALL usar `object` diferente para cada shape possível.

### REQ-003 - Centralizar identifiers

WHEN código precisar de um valor de `object`
THE SYSTEM SHALL usar o catálogo centralizado de response object types.

## Critérios De Aceite

- Existe catálogo centralizado de response object types.
- `GET /transactions` retorna `object = transaction.list`.
- Summary simples de transactions retorna `object = transaction_summary.type`.
- Summary agrupado de transactions retorna `object = transaction_summary.overview`.
- Docs de integração explicam o padrão.
- Docs técnicas de plataforma explicam o padrão.
- `AGENTS.md` registra a regra para futuras implementações.
