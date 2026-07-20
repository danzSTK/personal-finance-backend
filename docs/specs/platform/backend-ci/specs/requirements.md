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
- Cancelar execucoes obsoletas da mesma referencia.
- Usar permissoes somente de leitura no repositorio.

## Fora Do Escopo

- Publicar imagem Docker.
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

## Casos Limite

- Os jobs devem permanecer independentes para que uma falha de qualidade nao esconda o resultado das suites de teste.
- Os testes de integracao devem usar Docker/Testcontainers sem depender de servicos persistentes no runner.
- Alteracoes no proprio workflow devem iniciar a CI.
- O uso futuro de checks obrigatorios deve revisar o impacto dos filtros de caminho em pull requests somente de documentacao.

## Criterios De Aceite

- O workflow existe em `.github/workflows/backend-ci.yml`.
- Os comandos executados correspondem aos scripts versionados em `api/package.json`.
- `format:check`, `lint:check`, `typecheck`, `build`, testes unitarios, E2E e integracao passam no baseline.
- O workflow nao contem secrets nem permissoes de escrita.
- A PR da fase de CI referencia a issue 38 sem encerra-la.
