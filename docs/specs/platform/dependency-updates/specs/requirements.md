# Atualizações De Dependências — Requisitos

## Objetivo

Automatizar a descoberta semanal de novas versões das dependências do backend e permitir que correções de vulnerabilidades sejam propostas assim que o GitHub publicar um alerta aplicável.

Nesta evolução, o processo também deve tratar em conjunto uma atualização de dependência cujo novo engine mínimo exige a troca coordenada do runtime suportado.

## Contexto

- O repositório usa npm, GitHub Actions, Dockerfile e Docker Compose.
- Dependabot Alerts, Dependabot Security Updates e Dependabot Version Updates estão habilitados no GitHub.
- Toda atualização deve passar pela Backend CI e por revisão humana.
- O maintainer fará a triagem semanal às segundas-feiras.

## Escopo

- Monitorar o projeto npm em `/api`.
- Monitorar todas as GitHub Actions em `/.github/workflows`.
- Monitorar a imagem base declarada em `/api/Dockerfile`.
- Monitorar as imagens declaradas nos arquivos Docker Compose da raiz.
- Executar as verificações semanais às segundas-feiras no fuso `America/Fortaleza`.
- Escalonar os horários para distribuir a criação das pull requests.
- Agrupar atualizações minor e patch de npm e GitHub Actions.
- Manter atualizações major em pull requests individuais.
- Aplicar limites de pull requests abertas por ecossistema.
- Executar a Backend CI em qualquer pull request de atualização.
- Manter security updates prioritários e sem merge automático.
- Migrar o runtime suportado de Node.js 22 para Node.js 24 Active LTS.
- Atualizar `geoip-lite` para a linha 2.x e sua dependência transitiva corrigida `ip-address` somente junto do runtime compatível.
- Manter Docker, desenvolvimento local, CI, engines npm e documentação na mesma major de Node.js.

## Fora Do Escopo

- Fazer merge automático.
- Alterar regras de branch protection ou rulesets.
- Agrupar dependências de ecossistemas diferentes.
- Configurar registries privados.
- Ignorar atualizações major.
- Agrupar security updates no arquivo de configuração.
- Corrigir automaticamente incompatibilidades introduzidas por uma atualização.
- Adotar Node.js 26 antes de sua entrada em LTS.
- Alterar o contrato HTTP, o modelo de sessão ou o resultado exposto pelo provider de geolocalização.
- Corrigir na mesma mudança os alerts não relacionados de `brace-expansion` e `js-yaml`.

## Requisitos Funcionais

1. WHEN chegar segunda-feira às 09:00 em `America/Fortaleza`, THE SYSTEM SHALL verificar as dependências npm em `/api`.
2. WHEN chegar segunda-feira às 09:30, THE SYSTEM SHALL verificar as GitHub Actions do repositório.
3. WHEN chegar segunda-feira às 10:00, THE SYSTEM SHALL verificar a imagem base em `/api/Dockerfile`.
4. WHEN chegar segunda-feira às 10:30, THE SYSTEM SHALL verificar as imagens dos arquivos Docker Compose da raiz.
5. WHEN existirem atualizações minor ou patch de npm, THE SYSTEM SHALL agrupá-las em uma pull request.
6. WHEN existirem atualizações minor ou patch de GitHub Actions, THE SYSTEM SHALL agrupá-las em uma pull request.
7. WHEN existir uma atualização major, THE SYSTEM SHALL criar uma pull request individual sujeita ao limite do ecossistema.
8. WHEN uma pull request do Dependabot alterar API, Dockerfile, Compose ou qualquer workflow, THE SYSTEM SHALL executar a Backend CI.
9. WHEN um Dependabot Alert possuir uma atualização segura disponível, THE SYSTEM SHALL permitir que o Dependabot Security Updates tente criar uma pull request sem aguardar a janela semanal.
10. WHEN uma pull request de segurança for criada, THE SYSTEM SHALL exigir CI e revisão humana antes do merge.
11. IF a CI falhar ou o changelog indicar incompatibilidade, THEN o maintainer deve corrigir, adiar ou fechar a pull request.
12. WHEN uma atualização de dependência exigir Node.js 24, THE SYSTEM SHALL atualizar em conjunto o runtime local, a CI, as imagens Docker e o engine declarado pelo pacote.
13. WHEN o backend instalar `geoip-lite` 2.x, THE SYSTEM SHALL usar Node.js 24 e uma versão corrigida de `ip-address`.
14. WHEN o backend executar em Node.js 24, THE SYSTEM SHALL preservar o contrato atual de `GeoIpLiteProvider.lookup()`.
15. IF uma PR automática propuser Node.js 26 antes de sua entrada em LTS, THEN o maintainer deve substituí-la por uma atualização manual para Node.js 24 Active LTS.
16. WHEN a instalação for regenerada, THE SYSTEM SHALL produzir um lockfile instalável de forma limpa sob Node.js 24.
17. WHEN a migração for concluída, THE SYSTEM SHALL executar qualidade, testes unitários, E2E, integração e smoke da imagem de produção.

## Casos Limite

- Security updates não seguem o agrupamento semanal de version updates.
- Dependabot pode não conseguir gerar uma correção quando nenhuma versão compatível estiver disponível.
- Labels customizadas inexistentes no repositório são ignoradas pelo GitHub.
- Atualizações agrupadas podem exigir revisão individual dos changelogs de todos os pacotes incluídos.
- O limite de pull requests abertas pode adiar novas version updates até que PRs existentes sejam concluídas.
- Version updates recém-publicadas podem ser adiadas pelo cooldown padrão do GitHub; security updates não usam esse cooldown.
- Uma atualização npm pode ser válida isoladamente no registry, mas impossível de instalar enquanto a CI e o engine raiz permanecerem em uma major anterior do Node.js.
- Dependabot Alerts refletem o dependency graph da branch padrão; correções presentes somente em `develop` permanecem abertas até chegarem à branch padrão e o grafo ser reprocessado.

## Critérios De Aceite

- Existe `.github/dependabot.yml` com `version: 2`.
- Os quatro ecossistemas e diretórios correspondem aos manifests versionados.
- Os quatro horários usam `America/Fortaleza` e não se sobrepõem.
- Minor e patch de npm e GitHub Actions são agrupados somente para version updates.
- Não existe configuração de automerge.
- As labels customizadas referenciadas pela configuração existem no repositório.
- Os filtros da Backend CI cobrem todos os arquivos que o Dependabot pode alterar.
- O fluxo semanal e o fluxo de vulnerabilidades estão documentados.
- `.nvmrc`, `package.json`, Backend CI e os dois estágios do Dockerfile usam Node.js 24.
- `geoip-lite` está na linha 2.x e a árvore resolvida usa `ip-address` em versão corrigida.
- A instalação limpa não apresenta `EBADENGINE`.
- O provider de geolocalização mantém o mesmo contrato e possui cobertura para resultado encontrado e ausência de resultado.
- A imagem de produção em Node.js 24 passa pelo container smoke test.
