---
area: platform
feature: self-hosted-postgres
type: spec-requirements
status: current
related:
  - ./design.md
  - ./tasks.md
  - ./decisions.md
  - ../../../../deploy.md
  - ../../../../configuration.md
  - ../../../../architecture/compatibility.md
---

# PostgreSQL Auto-Hospedado — Requisitos

## Objetivo

Restabelecer a produção após a remoção do PostgreSQL no Amazon RDS, executando o PostgreSQL 16 como mais um serviço do Docker Compose da VM Oracle, ao lado de API, worker e dos dois Redis.

## Contexto

- O RDS `danfy-finance-app-db-postgres` foi removido. Desde então, `POSTGRES_HOST` não resolve (`ENOTFOUND`), `/health/readiness` falha e o worker permanece `unhealthy`.
- A VM é Ubuntu 24.04 `aarch64`, com 2 vCPU, 11 GiB de RAM e cerca de 34 GB de disco livre. Os containers atuais usam cerca de 700 MiB.
- O ambiente está em v0 e não há dados a preservar: o banco recomeça vazio e as 24 migrations existentes são aplicadas do zero.
- O Compose de produção e o executor `danfy-backend-deploy` pertencem ao repositório `danfy-infra`; a aplicação pertence a este repositório.
- Hoje [`postgres.module.ts`](../../../../../api/src/database/postgres/postgres.module.ts) e [`data-source.ts`](../../../../../api/src/database/data-source.ts) forçam `ssl: { rejectUnauthorized: false }` quando `NODE_ENV=production`, o que impede conectar a um PostgreSQL sem TLS.
- O executor sobe somente `redis bullmq-redis` antes das migrations, que rodam com `--no-deps`.

## Escopo

- Serviço `postgres` no Compose de produção, acessível apenas pela `app-network`.
- Variável `POSTGRES_SSL` para escolher TLS na conexão da aplicação e das migrations.
- Inclusão do PostgreSQL nas dependências iniciadas e aguardadas pelo executor antes das migrations.
- Atualização de `backend.env` e instalação do Compose e do executor na VM.
- Reset dos volumes dos dois Redis, que guardam sessões, cache e jobs do banco anterior.
- Atualização dos documentos de deploy, configuração, compatibilidade e dos runbooks.

## Fora Do Escopo

- Restaurar dados do RDS.
- Automação de backup e teste de restore (acompanhamento recomendado, registrado em `tasks.md`).
- TLS entre a aplicação e o PostgreSQL dentro da rede interna do Compose.
- Alta disponibilidade, réplica, pooler e upgrade de versão major.
- Role de aplicação sem privilégio de superusuário (ver `decisions.md`, DEC-007).
- Correção do filtro global que responde 500 em vez de 503 em `/health/readiness`.

## Requisitos Funcionais

### Aplicação

1. WHEN `POSTGRES_SSL` estiver ausente, THE SYSTEM SHALL manter o comportamento atual: TLS com `rejectUnauthorized: false` em `NODE_ENV=production` e sem TLS nos demais ambientes.
2. WHEN `POSTGRES_SSL=false`, THE SYSTEM SHALL conectar sem TLS, tanto na aplicação quanto na CLI de migrations, em qualquer `NODE_ENV`.
3. WHEN `POSTGRES_SSL=true`, THE SYSTEM SHALL conectar com TLS e `rejectUnauthorized: false`, em qualquer `NODE_ENV`.
4. IF `POSTGRES_SSL` contiver um valor que não seja booleano, THEN a validação de configuração SHALL impedir o início do processo.
5. THE SYSTEM SHALL decidir o TLS por uma única função usada pelo módulo TypeORM e pelo `DataSource` das migrations, evitando divergência entre os dois caminhos.

### Infraestrutura

6. THE SYSTEM SHALL executar o PostgreSQL com imagem de versão minor fixa, sem tag móvel de major ou `latest`.
7. THE SYSTEM SHALL manter os dados em volume nomeado, sem bind mount e sem publicar porta no host.
8. WHEN o container `postgres` não estiver saudável, THE SYSTEM SHALL impedir que `api` e `worker` sejam ativados pelo Compose.
9. WHEN um deploy mudar somente imagem, versão ou commit do backend, THE SYSTEM SHALL manter o container `postgres` sem recriação ou reinício.
10. WHEN o executor preparar um deploy, THE SYSTEM SHALL iniciar e aguardar `postgres`, `redis` e `bullmq-redis` antes das migrations.
11. THE SYSTEM SHALL ler usuário, senha e nome do banco do mesmo `backend.env` usado pela aplicação, sem duplicar segredos em arquivos versionados.
12. THE SYSTEM SHALL fixar no Compose o destino `postgres:5432` e `POSTGRES_SSL=false` para API e worker, impedindo que um `backend.env` desatualizado aponte para o RDS removido.
13. THE SYSTEM SHALL permitir parada graciosa do PostgreSQL com tempo suficiente para checkpoint.

### Operação

14. WHEN o banco for criado vazio, THE SYSTEM SHALL aplicar todas as migrations existentes pelo mesmo comando do executor (`npm run migration:run:prod`) e concluir sem intervenção manual.
15. WHEN o novo banco entrar em produção, THE SYSTEM SHALL iniciar com Redis de cache e Redis do BullMQ vazios.
16. WHEN o deploy concluir, THE SYSTEM SHALL responder `200` em `/health/readiness` e o worker SHALL passar em `npm run health:worker`.

## Casos Limite

- Uma imagem anterior à introdução de `POSTGRES_SSL` (`v0.1.3` e anteriores) força TLS e não conecta ao PostgreSQL sem TLS. O rollback automático ou manual para elas deixa de funcionar nesta topologia e o limite fica registrado em `compatibility.md`.
- `docker compose down -v` ou remoção manual do volume `app_postgresdata` apaga todos os dados; nenhum runbook ou script deve usar esses comandos no ambiente de produção.
- Reinício do host: `restart: always` e o healthcheck devem reconduzir a stack ao estado saudável sem intervenção.
- Se o PostgreSQL ficar `unhealthy`, o deploy falha antes das migrations e a versão atual é preservada.
- Memória: o worker usa cerca de 460 de 512 MiB. O PostgreSQL deve ter limite próprio e não pode reduzir a folga dos demais containers.
- `POSTGRES_PASSWORD` só é aplicado na criação do volume. Trocar o valor no `backend.env` depois exige alterar a senha no banco com `ALTER ROLE`.

## Critérios De Aceite

- Dado `NODE_ENV=production` e sem `POSTGRES_SSL`, as opções do TypeORM e do `DataSource` continuam com `ssl: { rejectUnauthorized: false }`.
- Dado `NODE_ENV=production` e `POSTGRES_SSL=false`, as duas configurações retornam `ssl: false`.
- Dado `POSTGRES_SSL=talvez`, a validação rejeita a configuração.
- `docker compose config --quiet` valida o Compose com o fixture do repositório de infraestrutura.
- Os testes do executor provam que `postgres` é iniciado antes das migrations.
- Em um PostgreSQL 16 vazio e sem TLS, `migration:run:prod` aplica as 24 migrations e termina com código 0.
- Na VM, `docker compose ps` mostra `postgres`, `redis`, `bullmq-redis`, `api` e `worker` saudáveis.
- Um novo `up api worker` com outra imagem não altera o `StartedAt` do container `postgres`.
- `https://api.danfy.app/health/readiness` responde `200`.
