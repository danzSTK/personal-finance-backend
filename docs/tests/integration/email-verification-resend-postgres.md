# `email-verification-resend-postgres.integration-spec.ts`

## Classificação e objetivo

- Arquivo: `api/test/email-verification-resend-postgres.integration-spec.ts`
- Categoria: integração.
- Objetivo: validar a migration incremental de origem e prazo de entrega.
- Fora de escopo: Redis, NestJS, fila e provider de e-mail.

## Comportamentos comprovados

- registros anteriores recebem `LEGACY_UNKNOWN`;
- inserts equivalentes a code N continuam funcionando depois da migration e
  recebem o default `LEGACY_UNKNOWN`;
- origem inválida é rejeitada;
- unique partial permite vários manuais e somente um automático por
  usuário/finalidade;
- `deliver_before` aceita `null` e instante futuro, rejeitando prazo igual à
  criação;
- migration executa `up/down/up` e restaura as duas colunas corretamente.

## Composição

- Componentes reais: PostgreSQL 16, migration TypeORM e constraints/índice.
- Componentes mockados: tabelas-base mínimas anteriores à migration.

## Dependências de execução

| Dependência | Versão                           | Provisionamento               | Obrigatória |
| ----------- | -------------------------------- | ----------------------------- | ----------- |
| PostgreSQL  | `16-alpine`                      | Testcontainers, porta efêmera | sim         |
| Docker      | versão disponível no host/runner | daemon local ou CI            | sim         |

PostgreSQL/Testcontainers já existiam no projeto e no job de integração. Não há
nova imagem, secret, porta fixa, acesso de produção ou alteração de pipeline.

## Isolamento e cleanup

As tabelas mínimas são recriadas antes de cada cenário. Banco, credenciais e
UUIDs são sintéticos; DataSource e container são encerrados em `afterAll`.

## Execução

```bash
npm run test:integration -- --runTestsByPath test/email-verification-resend-postgres.integration-spec.ts
npm run test:integration
```

- Job de CI: `Integration tests`.
- Falhas de ambiente: Docker indisponível ou download da imagem bloqueado.

## Quando atualizar

Atualizar quando mudarem migration, coluna, backfill, constraint, índice,
estratégia expand/migrate/contract, rollback ou imagem PostgreSQL.
