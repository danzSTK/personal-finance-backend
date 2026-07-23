---
area: platform
type: reference
status: current
last_reviewed: 2026-07-23
related:
  - ./getting-started.md
  - ./database/schema.md
  - ./platform/worker-operations.md
---

# Comandos principais

Execute scripts npm a partir de `api/`. Execute comandos Docker Compose a partir da raiz do repositório.

## Instalação e execução

| Comando                     | O que faz                                            | O que esperar                                        |
| --------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| `npm ci`                    | instala as versões exatas do lockfile                | `node_modules/` reproduzível e lockfile inalterado   |
| `npm run build`             | compila API, worker e comandos NestJS                | artefatos em `api/dist/`                             |
| `npm run start:dev`         | inicia a API com watch                               | HTTP em `http://localhost:3000`                      |
| `npm run start:worker:dev`  | inicia o worker com watch                            | processamento assíncrono e heartbeat, sem porta HTTP |
| `npm run start:prod`        | inicia a API compilada                               | exige `npm run build` e configuração válida          |
| `npm run start:worker:prod` | inicia o worker compilado                            | exige `dist/` e dependências externas                |
| `npm run health:worker`     | verifica PostgreSQL, Redis, BullMQ Redis e heartbeat | exit code `0` quando o worker está saudável          |

API e worker são processos complementares. Iniciar apenas a API deixa eventos, reconciliação, e-mails e jobs aguardando processamento.

## Qualidade

| Comando                | O que faz                              | Altera arquivos?         |
| ---------------------- | -------------------------------------- | ------------------------ |
| `npm run format`       | aplica Prettier em `src/` e `test/`    | sim                      |
| `npm run format:check` | verifica formatação sem corrigir       | não                      |
| `npm run lint`         | executa ESLint com correção automática | pode alterar             |
| `npm run lint:check`   | executa ESLint sem correção            | não                      |
| `npm run typecheck`    | valida tipos sem emitir JavaScript     | não                      |
| `npm run build`        | compila o projeto com NestJS           | cria ou atualiza `dist/` |

Antes de abrir uma PR, o mínimo recomendado é:

```bash
npm run format:check
npm run lint:check
npm run typecheck
npm run build
```

## Testes

### Unitários

```bash
npm run test
```

Valida entidades, value objects, casos de uso, configuração e componentes isolados. A execução termina com o resumo das suites e dos testes aprovados ou falhos.

Durante desenvolvimento:

```bash
npm run test:watch
```

O Jest permanece ativo e reexecuta testes afetados por alterações.

### Cobertura

```bash
npm run test:cov -- --runInBand
```

Executa os testes unitários, apresenta o resumo de cobertura e grava o relatório em `api/coverage/`. A CI coleta cobertura, mas atualmente não aplica um percentual global como gate.

### E2E

```bash
npm run test:e2e -- --runInBand
```

Inicializa a aplicação NestJS para validar rotas, autenticação, guards, validação e serialização com Supertest. A suite usa doubles quando o cenário não exige infraestrutura externa real.

### Integração

```bash
npm run test:integration
```

Primeiro compila a aplicação e depois executa Jest sequencialmente com Testcontainers. É necessário ter Docker ativo. A suite cria dependências descartáveis como PostgreSQL, Redis e Toxiproxy e pode levar mais tempo que as demais.

### Diagnóstico de teste

```bash
npm run test:debug
```

Inicia o Jest aguardando um debugger Node.js. Use apenas durante investigação; esse comando não faz parte da CI.

## Migrations

Antes de criar ou executar uma migration, leia [Schema do banco](./database/schema.md) e as migrations existentes.

| Comando                                             | Uso                                            |
| --------------------------------------------------- | ---------------------------------------------- |
| `npm run migration:show`                            | mostra migrations aplicadas e pendentes        |
| `npm run migration:create --name=NomeDaMigration`   | cria uma migration vazia                       |
| `npm run migration:generate --name=NomeDaMigration` | gera SQL a partir das diferenças das entidades |
| `npm run migration:run`                             | aplica migrations pendentes usando TypeScript  |
| `npm run migration:revert`                          | reverte a migration mais recente               |
| `npm run migration:show:prod`                       | mostra migrations usando o build de `dist/`    |
| `npm run migration:run:prod`                        | aplica migrations usando o build de `dist/`    |
| `npm run migration:revert:prod`                     | reverte usando o build de `dist/`              |

Sempre revise o SQL gerado e atualize `docs/database/schema.md` quando houver alteração de tabela, coluna, constraint, índice, trigger, função, enum ou invariante no banco.

## Docker Compose local

Os comandos usam o arquivo base e o ambiente de desenvolvimento de forma explícita:

```bash
docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  config --quiet
```

Valida interpolação e merge da configuração sem iniciar containers.

```bash
docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  up -d postgres redis bullmq-redis
```

Inicia apenas a infraestrutura recomendada para API e worker locais.

```bash
docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  ps
```

Mostra estado e health dos serviços.

```bash
docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  logs -f postgres redis bullmq-redis
```

Acompanha logs das dependências. Remova `-f` para apenas imprimir e sair.

```bash
docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  down
```

Encerra containers e rede, preservando volumes. O parâmetro `--volumes` apaga os dados locais e deve ser usado intencionalmente.

## Health checks

Com a API ativa:

```bash
curl --fail http://localhost:3000/health/liveness
curl --fail http://localhost:3000/health/readiness
```

- `liveness` confirma que o processo HTTP responde;
- `readiness` confirma que a API está pronta e alcança dependências essenciais;
- `npm run health:worker` valida dependências e heartbeat do processo assíncrono.

## Equivalência com a CI

Para reproduzir localmente as validações de código:

```bash
npm ci
npm run format:check
npm run lint:check
npm run typecheck
npm run build
npm run test:cov -- --runInBand
npm run test:e2e -- --runInBand
npm run test:integration
```

O smoke test completo da imagem possui configuração própria na CI. Consulte [Integração contínua](./platform/continuous-integration.md) para entender cada job.
