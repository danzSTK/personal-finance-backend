# `account-templates-postgres.integration-spec.ts`

## Classificação e objetivo

- Arquivo: `api/test/account-templates-postgres.integration-spec.ts`
- Categoria: integração.
- Objetivo: provar a migration expand de account templates e a compatibilidade de banco da v0.3.
- Fora de escopo: Redis, NestJS HTTP, BrasilAPI, CDN e Object Storage.

## Comportamentos comprovados

- `accounts.template_id` nasce nullable e linhas anteriores preservam `color`/`icon`;
- inserts e updates equivalentes à v0.3 continuam funcionando depois da expand;
- constraints e índices da tabela nova existem e rejeitam estados incoerentes;
- template referenciado não pode ser removido;
- exclusão do usuário remove account e custom na mesma transação com FK deferred;
- migration suporta `up/down/up` em PostgreSQL real.
- query equivalente a code N+1 falha antes da expand e funciona depois dela;
- workers concorrentes usam `FOR UPDATE SKIP LOCKED` sem selecionar a mesma account;
- `EXPLAIN (ANALYZE, BUFFERS)` usa `idx_accounts_template_id` em lookup seletivo com 5.000 accounts sintéticas.

## Composição

- Componentes reais: PostgreSQL 16, migration TypeORM, constraints, índices, trigger e FKs.
- Componentes sintéticos: tabelas-base mínimas de `users` e `accounts` anteriores à expand.

## Dependências de execução

| Dependência | Versão | Provisionamento | Obrigatória |
| --- | --- | --- | --- |
| PostgreSQL | `16-alpine` | Testcontainers, porta efêmera | sim |
| Docker | versão disponível no host/runner | daemon local ou CI | sim |

Não há imagem, secret, porta fixa, acesso de produção nem alteração nova de pipeline. O job `Integration tests` já fornece Docker.

## Isolamento e cleanup

As tabelas são recriadas por cenário. Banco, credenciais e UUIDs são sintéticos; DataSource e container são encerrados em `afterAll`.

## Execução

```bash
npm run test:integration -- account-templates-postgres.integration-spec.ts
npm run test:integration
```

Falha antes dos testes com “Could not find a working container runtime strategy” significa Docker indisponível no host local.

## Quando atualizar

Atualizar quando mudarem schema, migration, constraints, índices, cascades ou o contrato `DB-COMPAT-002`.
