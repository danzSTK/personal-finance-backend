# Backend CI — Decisoes

## DEC-001 - Separar CI E CD

Status: accepted

Decision:
A validacao de codigo fica em `backend-ci.yml`; publicacao de imagem e deploy terao workflow separado.

Reason:
CI executa codigo de pull requests com permissao somente de leitura. CD exigira credenciais, ambientes protegidos, verificacao de saude e rollback.

Impact:
Esta entrega referencia a issue 38, mas nao a encerra.

## DEC-002 - Usar Tres Jobs Independentes

Status: accepted

Decision:
Qualidade, testes unitarios/E2E e integracao executam em jobs paralelos.

Reason:
Os resultados ficam claros e uma falha nao esconde as demais suites.

Impact:
`npm ci` executa uma vez por job, trocando algum consumo adicional por isolamento e menor tempo total.

## DEC-003 - Nao Executar Em Mudancas Somente De Documentacao

Status: accepted

Decision:
Usar filtros de caminho e excluir arquivos Markdown dos gatilhos automaticos.

Reason:
Mudancas somente documentais nao alteram o comportamento ou build do backend.

Impact:
Antes de tornar os jobs obrigatorios, sera necessario evitar que PRs documentais fiquem bloqueados por checks que nao iniciaram.

## DEC-004 - Nao Impor Threshold Global De Cobertura Nesta Fase

Status: accepted

Decision:
Executar cobertura e registrar o resultado sem reprovar por percentual minimo.

Reason:
O baseline global mistura camadas com alvos diferentes; o projeto define metas de 90% para dominio/aplicacao e 70% para infraestrutura.

Impact:
Thresholds por caminho/camada ficam para uma evolucao posterior da CI.

## DEC-005 - Usar Configuracao Ficticia No Job De Testes

Status: accepted

Decision:
Declarar no job `tests` valores locais ficticios para todas as variaveis obrigatorias validadas pelo `ConfigModule`.

Reason:
O Jest coleta cobertura de arquivos nao importados diretamente pelas suites e pode carregar a configuracao global. O runner nao possui o `.env` de desenvolvimento.

Impact:
Os testes reproduzem a validacao de configuracao sem armazenar secrets ou acessar servicos externos; e-mail permanece desabilitado e os endpoints apontam para `localhost`.

## DEC-006 - Validar O Artefato Em Um Smoke Test Compose Isolado

Status: accepted

Decision:
Adicionar um quarto job que constroi a imagem pelo Dockerfile, executa migrations e inicia API, worker e dependencias pelo Compose de producao com um overlay exclusivo da CI. O override local nao participa.

Reason:
Testcontainers valida integracoes da aplicacao, mas API e worker ainda executam pelo Node do runner. Ele nao detecta falhas no Dockerfile, na composicao, nos comandos dos containers ou nos health checks.

Impact:
A CI passa a validar o artefato implantavel sem publica-lo. O overlay adiciona um PostgreSQL descartavel porque producao usa banco externo, substitui nomes e portas para permitir isolamento e remove todos os recursos efemeros ao final.

## DEC-007 - Validar Alteracoes No Workflow De CD

Status: accepted

Decision:
Incluir `.github/workflows/backend-cd.yml` nos filtros de caminho da Backend CI.

Reason:
Os jobs da Backend CI sao checks obrigatorios da `main`. Uma PR que altera somente o CD precisa dispara-los para poder satisfazer a ruleset.

Impact:
Alteracoes no CD executam a suite completa do backend; mudancas somente em Markdown continuam ignoradas.

## DEC-008 - Validar O Compose De Desenvolvimento Versionado

Status: accepted

Decision:
Incluir `docker-compose.dev.yml` nos filtros de caminho da CI e validar seu merge com o Compose base antes do smoke test.

Reason:
O onboarding local deve ser reproduzivel a partir do repositorio. Uma configuracao Compose versionada pode divergir ou tornar-se invalida mesmo sem afetar o overlay exclusivo do smoke test.

Impact:
Mudancas no ambiente de desenvolvimento iniciam a Backend CI e falham cedo quando a composicao local nao puder ser resolvida.

## DEC-009 - Cobrir Todas As Pull Requests Do Dependabot

Status: accepted

Decision:
Observar `.github/workflows/*.yml` e `.github/dependabot.yml` nos filtros da Backend CI.

Reason:
O Dependabot pode atualizar qualquer Action versionada. A lista anterior cobria somente CI e CD e deixaria PRs de release ou conectividade sem os checks obrigatorios.

Impact:
Mudancas em qualquer workflow ou na politica do Dependabot executam a suite completa do backend.
