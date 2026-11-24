---
area: architecture
type: index
status: current
last_reviewed: 2026-10-30
related:
  - ./module-boundaries.md
  - ./compatibility.md
  - ../architecture.md
---

# Arquitetura e Fronteiras do Sistema

Este diretório documenta as regras de limites arquiteturais entre módulos de domínio e a matriz vinculante de compatibilidade de banco de dados e deploys.

## Mapa do Contexto

- [Limites Entre Módulos](./module-boundaries.md) — Regras de fronteira entre bounded contexts, direção de dependências, padrão de desacoplamento de storage e registro formal de dívidas técnicas.
- [Compatibilidade de Migrations](./compatibility.md) — Matriz N/N+1 de compatibilidade para deploy e rollback sem indisponibilidade no modelo `expand -> migrate -> contract`.

## Responsabilidade da Pasta

Consulte esta pasta quando a tarefa envolver:
- Comunicação ou criação de novas dependências entre módulos de domínio em `api/src/modules/`.
- Decisões de persistência cruzada ou criação de ports de aplicação.
- Avaliação de compatibilidade de deploy/rollback de migrations no modelo N/N+1.
