# Módulo Health — Instruções Locais

Este módulo expõe probes de liveness e readiness para orquestradores (Docker, Kubernetes) e monitoramento operacional da API.

## Documentação Obrigatória
Antes de planejar ou alterar código neste módulo, leia:
- `docs/deploy.md` — Seção de monitoramento e probes HTTP de readiness.
- `docs/platform/ci-cd/` — Verificações operacionais de saúde e CI.

## Regras de Fronteira e Invariantes
- **Endpoints Públicos:** Endpoints `/health` são públicos e utilizam o decorator `@Public()`.
- **Readiness:** A verificação de readiness valida a conectividade real com PostgreSQL e Redis sem abrir transações demoradas.
- **Isolamento:** Não acople regras de negócio ou use cases de domínio aos controllers de saúde.
