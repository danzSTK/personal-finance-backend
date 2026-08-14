# `email-template-registry-postgres.integration-spec.ts`

## Objetivo e cobertura

Valida a migration do catálogo lógico de templates: backfill da versão, remoção da
intenção de provider/ID externo e recusas de rollback diante de mensagens
reenfileiráveis ou chaves desconhecidas.

## Dependências

Usa um container `postgres:16-alpine`, TypeORM e as migrations envolvidas. Não usa
Redis, worker, Brevo ou credenciais reais. O DataSource e o container são fechados
no teardown.

## Execução

```bash
npm run test:integration -- --runTestsByPath test/email-template-registry-postgres.integration-spec.ts
npm run test:integration
```

Atualizar ao mudar schema, migration, chaves, versões ou invariantes de rollback.

