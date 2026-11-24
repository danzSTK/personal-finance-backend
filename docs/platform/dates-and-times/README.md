---
area: platform
type: index
status: current
last_reviewed: 2026-10-30
related:
  - ./dates-and-times.md
---

# Datas, Instantes e Fusos Horários

Este contexto documenta as regras estritas da plataforma Danfy para representação, persistência e tráfego de dados temporais.

## Mapa do Contexto

- [Datas e Instantes](./dates-and-times.md) — Separação entre datas civis (`DateOnly` em `YYYY-MM-DD`) e instantes no tempo (`Instant` em UTC ISO 8601), tipos no PostgreSQL e proibições de conversão de fuso.

## Responsabilidade da Pasta

Consulte esta pasta quando a tarefa envolver:
- Criação ou alteração de campos temporais no PostgreSQL (`date` vs `timestamptz`).
- Manipulação de datas em entidades de domínio (ex.: datas de transações, filtros de período).
- Contratos de serialização de datas na API HTTP.
