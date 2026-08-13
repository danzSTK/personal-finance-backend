# `worker-health-recovery.integration-spec.ts`

## Objetivo e cobertura

Valida que a saúde do worker degrada e se recupera diante de perda e retorno de
PostgreSQL, Redis de cache e Redis de BullMQ.

## Dependências

Usa uma rede Testcontainers, PostgreSQL `16-alpine`, dois Redis `7-alpine` e
Toxiproxy. Clientes e serviços de health são reais; não inicia API ou worker
completo. Proxies injetam indisponibilidade sem acessar rede externa.

O teardown fecha serviços/clientes e remove proxies, containers e rede mesmo após
falha.

## Execução

```bash
npm run test:integration -- --runTestsByPath test/worker-health-recovery.integration-spec.ts
npm run test:integration
```

Atualizar ao mudar dependências de saúde, timeouts, Toxiproxy, heartbeat ou cleanup.

