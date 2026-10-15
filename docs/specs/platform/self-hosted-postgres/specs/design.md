---
area: platform
feature: self-hosted-postgres
type: spec-design
status: current
related:
  - ./requirements.md
  - ./tasks.md
  - ./decisions.md
  - ../../../../deploy.md
  - ../../../../architecture/compatibility.md
---

# PostgreSQL Auto-Hospedado — Design

## Visão geral

```text
Cloudflare → NGINX (host) → 127.0.0.1:3000
                               │
        ┌──────────────────────┴───────────── app-network (bridge, sem acesso externo) ─┐
        │ api ─┐                                                                         │
        │      ├──► postgres:5432   (volume app_postgresdata)                           │
        │ worker┘──► redis:6379      (volume app_redisdata)                              │
        │      └───► bullmq-redis:6379 (volume app_bullmqredisdata)                     │
        └─────────────────────────────────────────────────────────────────────────────────┘
```

O PostgreSQL passa a ser um quarto serviço de dados, com o mesmo ciclo de vida dos Redis: sobe uma vez, permanece em execução entre releases e só é recriado quando sua imagem ou configuração mudar.

## Camadas e repositórios

| Repositório / camada                      | Mudança                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| Backend — infraestrutura (`api/src/database`, `api/src/config`) | resolução do TLS e leitura de `POSTGRES_SSL`                                         |
| Backend — documentação                    | deploy, configuração, arquitetura de compatibilidade, spec e índice                      |
| `danfy-infra` — `environments/production` | serviço `postgres`, volume, dependências e destino fixo do banco para API e worker       |
| `danfy-infra` — `tools/danfy-backend-deploy` | `postgres` entra em `start_dependencies`; novo teste do executor                       |
| `danfy-infra` — documentação              | runbooks e README                                                                        |
| VM Oracle                                 | `backend.env`, Compose, executor, volumes e reset dos Redis                              |

Nenhuma entidade de domínio, caso de uso, controller ou schema muda. Não há migration nova, portanto `docs/database/schema.md` permanece inalterado.

## Backend

### Resolução do TLS

Novo módulo `api/src/database/postgres/postgres-ssl.ts`, sem dependência de NestJS, TypeORM ou aliases `@/`, porque também é carregado pela CLI do TypeORM a partir de `dist/database/data-source.js`:

- `parsePostgresSslFlag(value?: string): boolean | undefined` converte `true` e `false` (sem diferenciar maiúsculas, aceitando espaços) e retorna `undefined` quando ausente ou vazio;
- `resolvePostgresSsl({ isProduction, enabled }): false | { rejectUnauthorized: false }` aplica `enabled ?? isProduction`.

A precedência é: valor explícito de `POSTGRES_SSL` > padrão por ambiente. O objeto `{ rejectUnauthorized: false }` não muda; a validação do certificado continua fora do escopo (DEC-004).

### Consumidores

- `database.config.ts` expõe `ssl?: boolean` com o valor interpretado de `POSTGRES_SSL`.
- `createPostgresOptions` (`postgres.module.ts`) passa `dbConfig.ssl` ao helper.
- `data-source.ts` interpreta `process.env.POSTGRES_SSL` com o mesmo helper, usando import relativo como os demais imports do arquivo.
- `config.module.ts` declara `POSTGRES_SSL: Joi.boolean().optional()`, sem default, para preservar o comportamento atual quando a variável não existir.

### Compatibilidade

A variável é opcional e o default preserva o comportamento da imagem anterior. Portanto code N+1 funciona com ou sem a variável no `backend.env`.

## Compose de produção (`danfy-infra`)

Novo serviço `postgres`:

- imagem `postgres:16.13-alpine`, `restart: always`, `stop_grace_period: 2m`;
- `POSTGRES_USER`, `POSTGRES_PASSWORD` e `POSTGRES_DB` interpolados de `backend.env` com `:?`, o mesmo arquivo passado ao Compose pelo executor via `--env-file`;
- volume nomeado `app_postgresdata` montado em `/var/lib/postgresql/data`;
- sem `ports`; acessível somente por `app-network`;
- healthcheck `pg_isready` com `start_period` para a inicialização do cluster;
- `mem_limit`, `cpus`, `shm_size`, `no-new-privileges` e rotação de logs, como os demais serviços;
- parâmetros ajustados à folga da VM e ao número de conexões previsto: `max_connections`, `shared_buffers`, `effective_cache_size`, `work_mem`.

Mudanças nos serviços existentes:

- `depends_on` do `x-backend-service` passa a incluir `postgres: condition: service_healthy`;
- `x-backend-environment` passa a fixar `POSTGRES_HOST: postgres`, `POSTGRES_PORT: 5432` e `POSTGRES_SSL: "false"`. Valores em `environment` têm precedência sobre `env_file`, como já ocorre com `REDIS_HOST`;
- o serviço `postgres` não recebe `BACKEND_VERSION`, `BACKEND_COMMIT`, `BACKEND_IMAGE` ou qualquer variável que mude a cada release. Assim o hash de configuração dele fica estável e o Compose não o recria no `up api worker`.

## Executor (`danfy-backend-deploy`)

`start_dependencies` passa a executar `up --detach --no-build --wait ... postgres redis bullmq-redis`. O restante do fluxo não muda:

1. `start_dependencies` (agora com PostgreSQL);
2. `run_migrations` com `--no-deps` contra um banco já saudável;
3. `activate_and_verify` somente de `api worker`.

O teste do executor passa a verificar, no log do mock, que o `up` das dependências inclui `postgres` e que acontece antes do `run` das migrations.

## Rollout

Ordem obrigatória, porque a API em execução (`v0.1.3`) não conecta a um banco sem TLS:

1. mergear as PRs do backend (`develop`, depois `main`) e do `danfy-infra`;
2. na VM, com a API atual já indisponível: instalar o Compose e o executor, atualizar `backend.env`, subir `postgres` e validar o healthcheck;
3. resetar os volumes dos dois Redis;
4. publicar a release que contém a flag; o Backend CD roda o executor, que migra o banco vazio e ativa API e worker;
5. validar `/health/readiness`, `health:worker` e o `StartedAt` do container `postgres`.

### Matriz N/N+1

| Combinação                                                    | Compatível? | Motivo                                                              |
| ------------------------------------------------------------- | ----------- | ------------------------------------------------------------------- |
| code N (`v0.1.3`) + PostgreSQL sem TLS                         | não         | força TLS; o servidor responde que não suporta SSL                  |
| code N+1 + PostgreSQL sem TLS e `POSTGRES_SSL=false`           | sim         | alvo desta mudança                                                  |
| code N+1 + RDS ou outro servidor com TLS, sem `POSTGRES_SSL`   | sim         | default de produção preservado                                      |
| rollback para code N após a troca de banco                     | não         | limite registrado em `compatibility.md`                             |

## Testes

- **Unitário (`postgres-ssl.spec.ts`):** `parsePostgresSslFlag` (`true`, `false`, caixa, espaços, vazio, ausente, inválido) e `resolvePostgresSsl` (produção com e sem flag, não produção com e sem flag).
- **Unitário (`postgres.module.spec.ts`):** `createPostgresOptions` com produção sem flag, produção com `ssl=false` e teste com `ssl=true`.
- **Configuração:** a validação Joi rejeita `POSTGRES_SSL` não booleano. Se o schema não puder ser exercitado isoladamente, extrair o fragmento para uma constante testável.
- **Integração manual:** PostgreSQL 16.13 efêmero sem TLS, `migration:run:prod` sobre `dist` compilado, e `migration:show:prod` para confirmar que as 24 migrations foram aplicadas.
- **Infra:** `bash -n`, ShellCheck, `tools/danfy-backend-deploy/tests/run.sh` e `docker compose config --quiet` com o fixture.
- **VM:** `compose ps`, readiness local e pública, `health:worker` e comparação do `StartedAt` do PostgreSQL antes e depois de um `up api worker`.

## Segurança

- Nenhuma porta do PostgreSQL é publicada; o firewall do host já bloqueia entradas além de 22, 80 e 443.
- Credenciais permanecem em `/opt/danfy/secrets/backend.env`, fora dos repositórios; fixtures usam valores fictícios.
- O volume de dados é local e não criptografado pela aplicação; a proteção do disco depende da Oracle.
- A conexão interna sem TLS fica restrita à bridge `app-network`.

## Documentação afetada

- `docs/deploy.md`: stack, diagrama, variáveis, requisitos da VM, comandos úteis e referência ao RDS;
- `docs/configuration.md` e `.env.exemple`: `POSTGRES_SSL`;
- `docs/architecture/compatibility.md`: contrato e limite de rollback;
- `README.md`: stack tecnológica;
- `docs/specs/README.md`: índice;
- `danfy-infra`: `README.md` e `docs/runbooks/backend-deploy.md`.
