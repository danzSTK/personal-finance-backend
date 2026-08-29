# Suítes de integração

Todas as suítes `api/test/*.integration-spec.ts` executam pelo comando agregado
`npm run test:integration`, após o build, em modo sequencial. O job de CI é
`Integration tests` e possui Docker disponível para Testcontainers.

| Suíte                                                                         | PostgreSQL | Redis cache | Redis BullMQ | Toxiproxy | Processos Nest |
| ----------------------------------------------------------------------------- | :--------: | :---------: | :----------: | :-------: | :------------: |
| [api-worker-flow](./api-worker-flow.md)                                       |     1      |      1      |      1       |    não    |  API + worker  |
| [bullmq-redis](./bullmq-redis.md)                                             |    não     |     não     |      1       |    não    |      não       |
| [email-template-registry-postgres](./email-template-registry-postgres.md)     |     1      |     não     |     não      |    não    |      não       |
| [email-verification-redis](./email-verification-redis.md)                     |    não     |      1      |     não      |    não    |      não       |
| [email-verification-resend-postgres](./email-verification-resend-postgres.md) |     1      |     não     |     não      |    não    |      não       |
| [link-email-provider-flow](./link-email-provider-flow.md)                     |     1      |     não     |     não      |    não    |      não       |
| [outbox-postgres](./outbox-postgres.md)                                       |     1      |     não     |     não      |    não    |      não       |
| [password-change-flow](./password-change-flow.md)                             |     1      |      1      |     não      |    não    |      não       |
| [password-change-postgres](./password-change-postgres.md)                     |     1      |     não     |     não      |    não    |      não       |
| [password-change-redis](./password-change-redis.md)                           |    não     |      1      |     não      |    não    |      não       |
| [process-config](./process-config.md)                                         |    não     |     não     |     não      |    não    |  subprocessos  |
| [worker-health-recovery](./worker-health-recovery.md)                         |     1      |      1      |      1       |     1     |      não       |

As imagens atuais são `postgres:16-alpine`, `redis:7-alpine` e a imagem padrão do
Testcontainers para Toxiproxy. Portas são efêmeras e nenhuma suíte acessa produção.

```bash
npm run test:integration
```

Filtros por arquivo não substituem esse comando na validação final ou na CI.
