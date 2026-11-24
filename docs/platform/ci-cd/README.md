---
area: platform
type: index
status: current
last_reviewed: 2026-10-30
related:
  - ./continuous-integration.md
  - ./continuous-delivery.md
  - ./dependency-updates.md
  - ./github-actions-backend-ci.example.yml
  - ../../deploy.md
---

# Integração e Entrega Contínua (CI/CD)

Este contexto documenta os pipelines de automação do GitHub Actions, estratégias de testes automatizados na esteira, atualização de dependências e processo de deploy/rollback.

## Mapa do Contexto

- [Continuous Integration](./continuous-integration.md) — Workflow da CI, suítes de teste executadas, governança de gates e matriz de jobs.
- [Continuous Delivery](./continuous-delivery.md) — Pipeline de CD, build de containers imutáveis, publicação no GHCR e deploy na VPS.
- [Dependency Updates](./dependency-updates.md) — Política de atualização de dependências via Dependabot e mitigação de vulnerabilidades.
- [Exemplo de Workflow CI](./github-actions-backend-ci.example.yml) — Arquivo de exemplo do GitHub Actions comentado para referência.

## Responsabilidade da Pasta

Consulte esta pasta quando a tarefa envolver:
- Alteração em workflows de GitHub Actions (`.github/workflows/`).
- Políticas de gates da CI, smoke test de container ou novos jobs.
- Estratégias de release, versionamento ou deploy automático.
