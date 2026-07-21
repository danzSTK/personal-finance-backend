# Automacao De Release — Requisitos

## Objetivo

Automatizar a preparacao das releases do backend associadas a issue 38, reduzindo o trabalho manual do maintainer sem acoplar versionamento ao build de imagem ou ao deploy.

## Contexto

- O codigo chega a `main` exclusivamente por pull request e ruleset.
- O projeto usa Conventional Commits e tera sua primeira release em `v0.1.0`.
- O Release Please deve criar e manter a PR de release e, apos o merge, criar tag, changelog e GitHub Release.
- O deploy sera implementado em workflow separado e reagira a uma release publicada.

## Escopo

- Executar Release Please quando um commit chegar a `main`.
- Permitir reexecucao manual para recuperacao operacional.
- Autenticar como GitHub App para permitir que eventos criados iniciem outros workflows.
- Criar ou atualizar uma PR de release contra `main`.
- Manter `CHANGELOG.md` e as versoes de `api/package.json` e `api/package-lock.json`.
- Criar tags no formato `vX.Y.Z` e uma GitHub Release publicada apos o merge da PR de release.

## Fora Do Escopo

- Executar testes, build Docker ou scan de imagem.
- Publicar imagem em registry.
- Executar migrations ou deploy.
- Fazer merge automatico da PR de release.
- Criar prereleases com sufixos como `-beta.1`.

## Requisitos Funcionais

1. WHEN um commit for integrado a `main`, THE SYSTEM SHALL executar o workflow de release.
2. WHEN existirem commits convencionais liberaveis desde a ultima release, THE SYSTEM SHALL criar ou atualizar uma PR de release contra `main`.
3. WHEN a PR de release for mesclada, THE SYSTEM SHALL criar a tag e a GitHub Release correspondentes.
4. IF a PR de release for apenas fechada, THEN nenhuma release ou deploy deve ser criado.
5. WHEN a primeira release for preparada, THE SYSTEM SHALL propor a versao `0.1.0` e a tag `v0.1.0`.
6. WHEN uma versao for atualizada, THE SYSTEM SHALL manter consistentes `api/package.json` e os campos de versao raiz do `api/package-lock.json`.
7. WHEN a GitHub Release for publicada, THE SYSTEM SHALL permitir que um workflow posterior baseado em `release.published` seja iniciado.

## Criterios De Aceite

- Existe um workflow isolado em `.github/workflows/release-please.yml`.
- O workflow usa `vars.RELEASE_APP_CLIENT_ID` e `secrets.RELEASE_APP_PRIVATE_KEY`.
- O workflow nao contem etapas ou credenciais de deploy.
- A configuracao usa manifest e representa o repositorio como um unico componente liberavel.
- A primeira versao configurada e `0.1.0`.
- Tags incluem o prefixo `v` e nao incluem nome de componente.
