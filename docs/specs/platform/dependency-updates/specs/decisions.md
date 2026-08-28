# Atualizações De Dependências — Decisões

## DEC-001 - Monitorar Quatro Ecossistemas

Status: accepted

Decision:
Configurar npm, GitHub Actions, Dockerfile e Docker Compose separadamente.

Reason:
Cada fonte possui manifest, risco, frequência de mudança e limite de pull requests próprios.

Impact:
O Dependabot executa quatro verificações semanais escalonadas.

## DEC-002 - Agrupar Minor E Patch De Npm E Actions

Status: accepted

Decision:
Agrupar version updates minor e patch de npm e GitHub Actions, mantendo atualizações major individuais.

Reason:
Reduzir ruído semanal sem misturar alterações com maior probabilidade de breaking changes.

Impact:
Uma PR agrupada exige revisar o conjunto de changelogs; majors permanecem isoladas.

## DEC-003 - Não Agrupar Security Updates No YAML

Status: accepted

Decision:
Aplicar os grupos somente a `version-updates` e deixar security updates seguirem o comportamento do GitHub.

Reason:
Correções de vulnerabilidade não devem aguardar o calendário semanal e precisam permanecer fáceis de priorizar.

Impact:
O agrupamento global de security updates, se desejado no futuro, deve ser uma decisão explícita separada.

## DEC-004 - Não Usar Automerge

Status: accepted

Decision:
Exigir Backend CI e revisão humana para toda atualização.

Reason:
Testes aprovados não substituem a análise de changelog, compatibilidade, supply chain e comportamento operacional.

Impact:
O maintainer decide merge, ajuste, adiamento ou fechamento de cada PR.

## DEC-005 - Observar Todos Os Workflows Na Backend CI

Status: accepted

Decision:
Substituir os filtros de workflows específicos por `.github/workflows/*.yml` e observar também `.github/dependabot.yml`.

Reason:
O Dependabot pode atualizar qualquer Action versionada. Uma PR que altere um workflow fora da lista antiga não receberia os checks obrigatórios.

Impact:
Mudanças em qualquer workflow ou na política do Dependabot executam a suíte completa da Backend CI.

## DEC-006 - Provisionar As Labels Customizadas

Status: accepted

Decision:
Manter as labels `backend`, `github-actions` e `docker` no repositório, além da label existente `dependencies`.

Reason:
O GitHub ignora labels customizadas inexistentes em vez de falhar a criação da pull request.

Impact:
As PRs ficam classificadas pelo ecossistema conforme `.github/dependabot.yml`.

## DEC-007 - Adotar Node.js 24 Active LTS

Status: accepted

Decision:
Migrar o backend de Node.js 22 para Node.js 24 e não aceitar a atualização automática direta para Node.js 26 nesta etapa.

Reason:
Node.js 24 é a linha Active LTS adequada ao runtime de produção. Node.js 26 ainda está na fase Current, enquanto `geoip-lite` 2.x já exige Node.js 24 como mínimo.

Impact:
Desenvolvimento local, engine npm, CI, builder e imagem de produção precisam mudar de forma coordenada para Node.js 24.

## DEC-008 - Integrar Runtime E Geoip Na Mesma Mudança

Status: accepted

Decision:
Atualizar `geoip-lite` para 2.x e `ip-address` para uma versão corrigida na mesma pull request que migra o runtime para Node.js 24.

Reason:
A atualização npm falha com `EBADENGINE` em Node.js 22. Separar as mudanças criaria um estado intermediário que não instala ou manteria os alerts abertos sem necessidade.

Impact:
As PRs automáticas de Node.js 26 e de `geoip-lite` serão substituídas por uma PR manual baseada em `develop`, validada como uma única unidade de compatibilidade.

## DEC-009 - Tratar Alerts Pela Branch Padrão

Status: accepted

Decision:
Usar a API de Dependabot Alerts como fonte do estado de segurança, considerando que os alerts refletem o dependency graph da branch padrão.

Reason:
Correções integradas somente em `develop` não encerram os alerts enquanto o lockfile corrigido não chegar à branch padrão e o GitHub não reprocessar o grafo.

Impact:
A validação em `develop` confirma a árvore corrigida localmente; o fechamento automático do alert é conferido novamente após a promoção para a branch padrão.

## DEC-010 - Aceitar A Resolução Transitiva De ip-address 10.5

Status: accepted

Decision:
Manter a faixa declarada por `geoip-lite` 2.0.3 e aceitar `ip-address` 10.5.0 como resolução transitiva do lockfile.

Reason:
A PR automática antiga resolvia 10.4.0, mas a instalação limpa atual seleciona 10.5.0. Essa versão remove dependências de runtime, corrige o contrato de falha de `Address6.fromURL`, possui commit assinado, integridade no registry e proveniência SLSA verificada por `npm audit signatures`.

Impact:
O lockfile registra `ip-address` 10.5.0 sem adicionar uma dependência direta desnecessária. Atualizações futuras continuam sob a faixa controlada por `geoip-lite`.
