# Backend CI — Design

## Arquitetura

A CI fica em um workflow separado do futuro CD. O arquivo `.github/workflows/backend-ci.yml` contem tres jobs paralelos e independentes:

1. `quality`: formatacao, lint, typecheck e build.
2. `tests`: testes unitarios com cobertura e teste E2E.
3. `integration`: testes com PostgreSQL, Redis e Toxiproxy gerenciados por Testcontainers.

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
        +-----------+-----------+
        |           |           |
     quality      tests     integration
```

Os jobs nao usam `needs`, portanto uma falha nao impede as demais validacoes de produzirem resultado.

## Seguranca

- `permissions.contents` permanece como `read`.
- A CI nao recebe secrets e pode executar codigo de pull requests.
- Build/publicacao de imagem e deploy ficarao em workflow separado com permissoes e gatilhos proprios.
- Actions oficiais sao usadas para checkout e configuracao do Node.js.

## Cobertura

`npm run test:cov` gera o relatorio e mostra o resumo nos logs. Nesta fase nao existe `coverageThreshold`; os alvos por camada devem ser definidos em trabalho posterior, sem aplicar 90% como limite global indiscriminado.

## Testes De Integracao

O script `test:integration` executa build e Jest em modo sequencial. Testcontainers controla imagens, portas e limpeza de PostgreSQL, Redis e Toxiproxy; nao sao declarados `services` duplicados no GitHub Actions.

## Filtros De Caminho

A execucao automatica observa `api/**`, Compose, `.env.exemple` e o proprio workflow, excluindo Markdown. Essa escolha reduz execucoes sem valor para o backend, mas devera ser reavaliada antes de configurar os jobs como checks obrigatorios.

## Impactos

- Banco de dados: nenhum.
- Migrations: nenhuma.
- API/contratos HTTP: nenhum.
- Codigo de producao: nenhum.
- Documentacao: exemplo didatico e especificacao desta fase.
