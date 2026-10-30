---
area: platform
type: index
status: current
last_reviewed: 2026-10-30
---

# Plataforma Danfy

Este diretório organiza as regras técnicas e convenções operacionais transversais da aplicação, estruturadas de forma modular por pastas de contexto.

## Contextos Modulares

Para evitar sobrecarga de contexto, consulte diretamente a pasta correspondente ao escopo da tarefa:

- [Workers e Filas (`workers/`)](./workers/README.md) — Infraestrutura BullMQ, concorrência, processadores em background e operações do Worker.
- [E-mail Transacional (`email/`)](./email/README.md) — Provedor Brevo, contratos de envio e adapters.
- [CI/CD e Entrega (`ci-cd/`)](./ci-cd/README.md) — Workflows do GitHub Actions, esteiras de testes e automação de releases.
- [Datas e Instantes (`dates-and-times/`)](./dates-and-times/README.md) — Separação rigorosa entre `DateOnly` e `Instant` e regras de persistência.
- [Objetos de Resposta (`response-objects/`)](./response-objects/README.md) — Padronização de DTOs com o discriminador `object`.
- [Padrões de Governança (`standards/`)](./standards/README.md) — Taxonomia e diretrizes para redação de issues do GitHub.
