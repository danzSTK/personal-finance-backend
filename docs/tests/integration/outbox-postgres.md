# `outbox-postgres.integration-spec.ts`

## Objetivo e cobertura

Valida claim concorrente com `SKIP LOCKED`, recuperação de lease, proteção contra
worker obsoleto e planos indexados de consultas da outbox e de e-mails pendentes.

## Dependências

Usa um container `postgres:16-alpine`, TypeORM e repositories reais. O schema
focado é criado por `synchronize` dentro do banco descartável. Não usa Redis,
processos ou rede externa. DataSource e container são fechados no teardown.

## Execução

```bash
npm run test:integration -- --runTestsByPath test/outbox-postgres.integration-spec.ts
npm run test:integration
```

Atualizar ao mudar estado, leases, índices, consultas ou entidades persistidas.

