# Atualizações De Dependências — Requisitos

## Objetivo

Automatizar a descoberta semanal de novas versões das dependências do backend e permitir que correções de vulnerabilidades sejam propostas assim que o GitHub publicar um alerta aplicável.

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

## Fora Do Escopo

- Fazer merge automático.
- Alterar regras de branch protection ou rulesets.
- Agrupar dependências de ecossistemas diferentes.
- Configurar registries privados.
- Ignorar atualizações major.
- Agrupar security updates no arquivo de configuração.
- Corrigir automaticamente incompatibilidades introduzidas por uma atualização.

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

## Casos Limite

- Security updates não seguem o agrupamento semanal de version updates.
- Dependabot pode não conseguir gerar uma correção quando nenhuma versão compatível estiver disponível.
- Labels customizadas inexistentes no repositório são ignoradas pelo GitHub.
- Atualizações agrupadas podem exigir revisão individual dos changelogs de todos os pacotes incluídos.
- O limite de pull requests abertas pode adiar novas version updates até que PRs existentes sejam concluídas.
- Version updates recém-publicadas podem ser adiadas pelo cooldown padrão do GitHub; security updates não usam esse cooldown.

## Critérios De Aceite

- Existe `.github/dependabot.yml` com `version: 2`.
- Os quatro ecossistemas e diretórios correspondem aos manifests versionados.
- Os quatro horários usam `America/Fortaleza` e não se sobrepõem.
- Minor e patch de npm e GitHub Actions são agrupados somente para version updates.
- Não existe configuração de automerge.
- As labels customizadas referenciadas pela configuração existem no repositório.
- Os filtros da Backend CI cobrem todos os arquivos que o Dependabot pode alterar.
- O fluxo semanal e o fluxo de vulnerabilidades estão documentados.
