# Suítes E2E

As suítes E2E atuais inicializam uma aplicação HTTP NestJS com Supertest, mas não
dependem de Docker ou serviços persistentes. Elas executam no job
`Unit and E2E tests` por `npm run test:e2e`.

| Suíte                                       | Responsabilidade principal                 | Dependência externa |
| ------------------------------------------- | ------------------------------------------ | ------------------- |
| [app](./app.md)                             | contrato `GET /`                           | nenhuma             |
| [change-password](./change-password.md)     | contrato HTTP da alteração de senha        | nenhuma             |

Se um E2E passar a exigir PostgreSQL, Redis ou outro serviço real, reclassifique o
cenário como integração ou atualize previamente a arquitetura e a pipeline.

