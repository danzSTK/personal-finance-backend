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
