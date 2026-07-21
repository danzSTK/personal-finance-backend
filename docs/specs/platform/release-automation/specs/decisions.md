# Automacao De Release — Decisoes

## DEC-001 - Separar Release Please Do CD

Status: accepted

Decision:
O Release Please somente administra PR de release, versao, changelog, tag e GitHub Release. Build, publicacao de imagem e deploy ficarao em `backend-cd.yml`.

Reason:
As responsabilidades exigem gatilhos, permissoes e credenciais diferentes.

Impact:
Uma falha ou alteracao no deploy nao amplia as permissoes do workflow de release.

## DEC-002 - Usar GitHub App Em Vez Do GITHUB_TOKEN

Status: accepted

Decision:
Gerar um token de instalacao a partir de `RELEASE_APP_CLIENT_ID` e `RELEASE_APP_PRIVATE_KEY`.

Reason:
Eventos criados com o `GITHUB_TOKEN` normalmente nao iniciam novos workflows. A GitHub App permite que a release publicada dispare o futuro CD sem usar um token pessoal de longa duracao.

Impact:
A App deve permanecer instalada e possuir permissoes de contents, issues e pull requests.

## DEC-003 - Usar Release Publicada Como Gatilho Futuro De Deploy

Status: accepted

Decision:
O futuro CD usara `release` com tipo `published`, nao fechamento de PR nem `push.tags`.

Reason:
Fechar uma PR nao significa mescla-la. A release publicada e o evento de dominio que confirma versao, tag e commit imutavel a implantar.

Impact:
O workflow de CD fara checkout do commit associado a tag da GitHub Release.

## DEC-004 - Liberar O Repositorio Como Um Unico Componente

Status: accepted

Decision:
Usar a estrategia `simple` no caminho raiz e atualizar os arquivos de versao Node como arquivos extras.

Reason:
O backend e um unico produto implantavel, embora o projeto Node esteja em `api/`. A raiz permite incluir mudancas de Compose e automacao no mesmo historico de release.

Impact:
O changelog fica na raiz, a tag sera `vX.Y.Z` e package.json e package-lock permanecem consistentes.

## DEC-005 - Iniciar Em v0.1.0 Sem Sufixo De Prerelease

Status: accepted

Decision:
A primeira release sera `v0.1.0`, publicada como release normal do GitHub.

Reason:
O produto esta em beta, mas a versao escolhida pelo maintainer nao usa sufixo SemVer como `-beta.1`.

Impact:
O futuro gatilho `release.published` nao precisara tratar prerelease nesta primeira fase.

## DEC-006 - Fixar Actions Privilegiadas Por SHA

Status: accepted

Decision:
Fixar por commit completo as actions que geram o token da GitHub App e executam o Release Please.

Reason:
O workflow recebe uma chave privada e permissoes de escrita; referencias moveis ampliariam o risco de supply chain.

Impact:
Atualizar essas actions exige revisar e substituir explicitamente os SHAs versionados.
