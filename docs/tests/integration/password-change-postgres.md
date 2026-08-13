# `password-change-postgres.integration-spec.ts`

## Objetivo e cobertura

Valida migrations e invariantes PostgreSQL da alteração de senha: fatos válidos,
coerência do bloqueio, tipos/metadata recusados, versão inicial positiva e uso do
índice composto de histórico.

## Dependências

Usa um container `postgres:16-alpine`, `pgcrypto`, TypeORM e as migrations de
password change. Cria tabelas mínimas de usuários/providers para validar as
migrations isoladamente. Não usa Redis nem aplicação NestJS.

## Execução

```bash
npm run test:integration -- --runTestsByPath test/password-change-postgres.integration-spec.ts
npm run test:integration
```

Atualizar ao mudar migrations, constraints, índices, tipos ou consultas de janela.

