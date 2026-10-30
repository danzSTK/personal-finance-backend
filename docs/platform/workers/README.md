---
area: platform
type: index
status: current
last_reviewed: 2026-10-30
related:
  - ./queue-infrastructure.md
  - ./worker-operations.md
  - ../../../events/README.md
---

# Workers e Processamento Assíncrono

Este contexto documenta a infraestrutura de filas, a execução desacoplada do processo Worker e os procedimentos operacionais de monitoramento e recuperação de jobs em segundo plano.

## Mapa do Contexto

- [Queue Infrastructure](./queue-infrastructure.md) — Infraestrutura BullMQ, conexão com Redis dedicado, convenção de filas, payloads versionados e retry.
- [Worker Operations](./worker-operations.md) — Procedimentos de inicialização, healthchecks, heartbeat, logs operacionais, troubleshooting e mitigação de falhas.

## Responsabilidade da Pasta

Consulte esta pasta quando a tarefa envolver:
- Criação, configuração ou consumo de filas BullMQ (`@nestjs/bullmq`).
- Processadores de jobs em segundo plano (`WorkerHost`).
- Concorrência de workers, consumo de CPU/memória em tarefas assíncronas.
- Monitoramento de instâncias, healthcheck de worker e recuperação operacional.
