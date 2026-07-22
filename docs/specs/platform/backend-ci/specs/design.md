# Backend CI — Design

## Arquitetura

A CI fica em um workflow separado do futuro CD. O arquivo `.github/workflows/backend-ci.yml` contem quatro jobs paralelos e independentes:

1. `quality`: formatacao, lint, typecheck e build.
2. `tests`: testes unitarios com cobertura e teste E2E.
3. `integration`: testes com PostgreSQL, Redis e Toxiproxy gerenciados por Testcontainers.
4. `container-smoke`: validacao do Compose, build da imagem, migrations e startup real de API e worker.

## Runner E Dependencias

- Runner: `ubuntu-24.04`, necessario para Docker/Testcontainers.
- Runtime da aplicacao: Node.js 22.
- Instalacao deterministica: `npm ci` com `api/package-lock.json`.
- Cache: downloads do npm configurados por `actions/setup-node`.
- Diretorio de execucao dos comandos: `api/`.

Cada job instala suas proprias dependencias. Isso repete `npm ci`, mas preserva isolamento e permite paralelismo.

## Fluxo

```text
pull_request | push | workflow_dispatch
                    |
        +-----------+-----------+-----------+
        |           |           |           |
     quality      tests     integration  container-smoke
```

Os jobs nao usam `needs`, portanto uma falha nao impede as demais validacoes de produzirem resultado.

## Seguranca

- `permissions.contents` permanece como `read`.
- A CI nao recebe secrets e pode executar codigo de pull requests.
- Build/publicacao de imagem e deploy ficarao em workflow separado com permissoes e gatilhos proprios.
- Actions oficiais sao usadas para checkout e configuracao do Node.js.

## Cobertura

`npm run test:cov` gera o relatorio e mostra o resumo nos logs. Nesta fase nao existe `coverageThreshold`; os alvos por camada devem ser definidos em trabalho posterior, sem aplicar 90% como limite global indiscriminado.

O job `tests` declara valores ficticios para as variaveis obrigatorias do `ConfigModule`. Isso e necessario porque a coleta de cobertura analisa arquivos fora do caminho executado pelas suites e aciona a validacao Joi. Os valores existem somente no runner, nao sao secrets e mantem provedores externos desabilitados.

## Testes De Integracao

O script `test:integration` executa build e Jest em modo sequencial. Testcontainers controla imagens, portas e limpeza de PostgreSQL, Redis e Toxiproxy; nao sao declarados `services` duplicados no GitHub Actions.

## Smoke Test De Containers

O job `container-smoke` usa o `api/Dockerfile` e o `docker-compose.yml` de producao para API, worker, Redis de cache e Redis de BullMQ. O Compose base referencia somente a imagem publicada, portanto o overlay exclusivo da CI restaura a configuracao de build e usa uma tag descartavel. Como o PostgreSQL de producao e externo, o overlay tambem adiciona um PostgreSQL descartavel somente para o smoke test. O `docker-compose.override.yml`, exclusivo do desenvolvimento local, nao participa da CI.

O fluxo valida o Compose, constroi a imagem, aguarda as dependencias, executa migrations pela imagem, inicia API e worker e verifica:

- health check de liveness da API dentro do container;
- endpoint de readiness da API contra PostgreSQL e Redis;
- comando `health:worker` contra PostgreSQL, cache Redis, BullMQ Redis e heartbeat.

O overlay exclusivo da CI remove nomes fixos, remove publicacoes desnecessarias das dependencias, publica a API em porta efemera e conecta API e worker ao PostgreSQL descartavel. O nome do projeto Compose inclui a execucao do GitHub para isolar recursos. Em falha, status e logs sao impressos; o cleanup com volumes e orfaos executa sempre.

## Filtros De Caminho

A execucao automatica observa `api/**`, o Compose de producao, a configuracao Compose da CI, `.env.exemple` e os workflows `backend-ci.yml` e `backend-cd.yml`, excluindo Markdown. O `docker-compose.override.yml` permanece fora por ser exclusivo do desenvolvimento local. Mudancas no CD executam a CI porque esses jobs sao checks obrigatorios da `main`; sem esse caminho, uma PR exclusiva do CD ficaria bloqueada aguardando checks que nunca foram disparados.

## Impactos

- Banco de dados: nenhum.
- Migrations: nenhuma.
- API/contratos HTTP: nenhum.
- Codigo de producao: nenhum; o Compose recebe health check operacional da API.
- Documentacao: exemplo didatico e especificacao desta fase.
