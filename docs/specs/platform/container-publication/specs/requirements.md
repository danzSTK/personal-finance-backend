# Publicacao Da Imagem — Requisitos

## Objetivo

Adicionar a primeira fase de continuous delivery da issue 38, construindo, verificando e publicando no GitHub Container Registry a imagem versionada do backend.

## Contexto

- O Release Please publica GitHub Releases com tags SemVer no formato `vX.Y.Z`.
- O servidor de producao usa arquitetura ARM64, enquanto desenvolvimento e outros ambientes podem usar AMD64.
- API e worker executam processos diferentes a partir do mesmo artefato.
- O deploy remoto sera implementado somente em uma fase posterior.

## Escopo

- Iniciar a publicacao em uma GitHub Release publicada e nao prerelease.
- Construir a imagem para `linux/amd64` e `linux/arm64`.
- Escanear as duas variantes antes de criar a tag oficial da imagem.
- Publicar a imagem em `ghcr.io/danzstk/personal-finance-backend`.
- Publicar tags imutaveis de versao e commit, sem `latest`.
- Exigir `APP_VERSION` no Compose base.
- Reservar o Compose base para imagens publicadas e mover builds locais para overrides.

## Fora Do Escopo

- Conectar ao servidor de producao.
- Executar migrations remotas.
- Atualizar containers em execucao.
- Executar smoke test pos-deploy ou rollback remoto.
- Publicar uma tag `latest`.
- Publicar prereleases.

## Requisitos Funcionais

1. WHEN uma GitHub Release normal for publicada, THE SYSTEM SHALL iniciar a publicacao da imagem.
2. WHEN a tag da release nao seguir `vX.Y.Z`, THE SYSTEM SHALL reprovar a execucao.
3. WHEN a publicacao iniciar, THE SYSTEM SHALL fazer checkout do commit exato da tag da release.
4. WHEN a imagem for construida, THE SYSTEM SHALL produzir variantes `linux/amd64` e `linux/arm64`.
5. WHEN cada variante for produzida, THE SYSTEM SHALL verificar vulnerabilidades corrigiveis de severidade High e Critical.
6. IF qualquer build ou scan falhar, THEN a tag oficial da release nao deve ser criada no GHCR.
7. WHEN as duas variantes passarem, THE SYSTEM SHALL publicar um unico manifest multi-arquitetura com as tags da release e do commit.
8. WHEN API e worker forem iniciados pelo Compose base, THE SYSTEM SHALL usar a mesma imagem versionada.
9. IF `APP_VERSION` estiver ausente, THEN o Compose deve falhar durante a interpolacao da configuracao.
10. WHEN o ambiente local ou o smoke test precisar construir a imagem, THE SYSTEM SHALL obter o `build` pelo override correspondente.

## Casos Limite

- Builds de arquiteturas diferentes nao podem sobrescrever a mesma tag antes da composicao do manifest.
- Um digest aprovado de apenas uma arquitetura nao pode produzir a tag da release.
- Reexecutar o mesmo evento pode reenviar os mesmos digests, mas nao cria `latest`.
- A imagem do GHCR pode ser privada; a autenticacao de leitura pelo servidor pertence a fase de deploy.
- A fixture do smoke test e o ambiente local precisam declarar `APP_VERSION`, pois a interpolacao ocorre antes do merge dos arquivos Compose.

## Criterios De Aceite

- Existe `.github/workflows/backend-cd.yml` sem job de deploy.
- O workflow usa somente `contents: read` e `packages: write`.
- O manifest publicado declara `linux/amd64` e `linux/arm64`.
- A imagem recebe `vX.Y.Z` e `sha-<curto>`, mas nao `latest`.
- Vulnerabilidades High/Critical corrigiveis impedem a criacao das tags oficiais.
- `docker compose config` falha sem `APP_VERSION` e passa quando ela e fornecida.
- O smoke test de containers continua construindo e iniciando API e worker localmente.
