# Backend CI — Requisitos

## Objetivo

Criar a primeira fase da automacao associada a issue 38: uma pipeline de integracao continua que valide o backend antes de merge ou promocao para deploy.

## Contexto

- Issue de origem: GitHub #38.
- O backend usa Node.js 22, NestJS, Jest, PostgreSQL, Redis e Testcontainers.
- O deploy automatizado, a infraestrutura NGINX e os respectivos rollbacks permanecem em fases posteriores.

## Escopo

- Executar CI em pull requests e pushes direcionados a `develop` e `main`.
- Permitir execucao manual.
- Ignorar alteracoes somente de documentacao Markdown.
- Validar formatacao, lint, tipos e build.
- Executar testes unitarios com cobertura, E2E e integracao.
- Validar a configuracao Docker Compose usada pelo backend.
- Construir a imagem de producao pelo `api/Dockerfile`.
- Executar um smoke test com PostgreSQL, Redis, API e worker em containers.
- Executar migrations pela imagem construida antes de iniciar a aplicacao.
- Validar liveness e readiness da API e o health check do worker.
- Cancelar execucoes obsoletas da mesma referencia.
- Usar permissoes somente de leitura no repositorio.

## Fora Do Escopo

- Publicar imagem Docker em registry.
- Executar migrations em ambiente remoto.
- Implantar API, worker ou NGINX.
- Configurar credenciais, GitHub Environments, health pos-deploy ou rollback.
- Reprovar a pipeline por percentual minimo de cobertura.

## Requisitos Funcionais

1. WHEN um pull request alterar arquivos relevantes do backend e apontar para `develop` ou `main`, THE SYSTEM SHALL executar a pipeline de CI.
2. WHEN houver push relevante em `develop` ou `main`, THE SYSTEM SHALL executar a pipeline de CI.
3. WHEN a execucao manual for solicitada, THE SYSTEM SHALL iniciar a pipeline sem depender de alteracoes de arquivos.
4. WHEN houver uma execucao mais recente para a mesma referencia, THE SYSTEM SHALL cancelar a execucao anterior.
5. WHEN formatacao, lint, tipos ou build falharem, THE SYSTEM SHALL reprovar o job de qualidade.
6. WHEN um teste unitario, E2E ou de integracao falhar, THE SYSTEM SHALL reprovar o job correspondente.
7. IF somente documentacao Markdown for alterada, THEN a pipeline automatica nao deve iniciar.
8. WHEN a configuracao Compose for invalida ou a imagem nao puder ser construida, THE SYSTEM SHALL reprovar o job de containers.
9. WHEN a imagem for construida, THE SYSTEM SHALL executar as migrations por essa imagem antes de iniciar API e worker.
10. WHEN API e worker iniciarem, THE SYSTEM SHALL exigir liveness e readiness saudaveis da API e health check saudavel do worker.
11. WHETHER o smoke test passe ou falhe, THE SYSTEM SHALL registrar diagnosticos em falha e remover containers, redes e volumes criados pela execucao.
12. WHEN o workflow de CD do backend for alterado, THE SYSTEM SHALL executar a CI antes do merge.

## Casos Limite

- Os jobs devem permanecer independentes para que uma falha de qualidade nao esconda o resultado das suites de teste.
- Os testes de integracao devem usar Docker/Testcontainers sem depender de servicos persistentes no runner.
- O smoke test deve usar somente valores ficticios e nao pode depender de secrets ou servicos externos.
- A execucao deve permanecer isolada de outros projetos Compose por nome de projeto e portas efemeras.
- Uma falha de startup deve preservar logs nos logs do job antes do cleanup.
- Alteracoes nos workflows de CI ou CD do backend devem iniciar a CI.
- O uso futuro de checks obrigatorios deve revisar o impacto dos filtros de caminho em pull requests somente de documentacao.

## Criterios De Aceite

- O workflow existe em `.github/workflows/backend-ci.yml`.
- Os comandos executados correspondem aos scripts versionados em `api/package.json`.
- `format:check`, `lint:check`, `typecheck`, `build`, testes unitarios, E2E e integracao passam no baseline.
- Docker Compose e Dockerfile sao validados por um smoke test que sobe API e worker com dependencias reais.
- As migrations executam pela imagem e os health checks de API e worker passam.
- O workflow nao contem secrets nem permissoes de escrita.
- A PR permanece em Draft durante a implementacao das proximas fases da issue 38 e a encerra somente quando o escopo completo estiver concluido.
