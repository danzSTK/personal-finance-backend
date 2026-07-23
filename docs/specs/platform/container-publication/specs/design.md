# Publicacao Da Imagem — Design

## Arquitetura

O workflow `.github/workflows/backend-cd.yml` e iniciado por `release.published` e possui duas fases:

```text
                 +-> build amd64 -> push por digest -> scan -+
release published                                         +-> criar manifest e tags
                 +-> build arm64 -> push por digest -> scan -+
```

Os builds executam em runners nativos:

- `linux/amd64` em `ubuntu-24.04`;
- `linux/arm64` em `ubuntu-24.04-arm`.

Isso evita emulacao QEMU e valida o artefato ARM no mesmo conjunto de instrucoes usado em producao.

## Publicacao Por Digest

Cada job da matriz envia ao GHCR um resultado enderecado somente pelo digest. Esse resultado ainda nao recebe `vX.Y.Z` nem `sha-*`. Apos o scan, o digest aprovado e transferido ao job final por um artefato vazio cujo nome e o hash SHA-256.

O job final exige os dois artefatos e cria um manifest OCI com:

- `ghcr.io/danzstk/personal-finance-backend:<release-tag>`;
- `ghcr.io/danzstk/personal-finance-backend:sha-<7 caracteres>`.

Nao existe tag `latest`.

## Seguranca

- O `GITHUB_TOKEN` recebe `contents: read` e `packages: write` somente nos jobs necessarios.
- Actions usadas no workflow de publicacao sao fixadas por SHA completo.
- O Trivy e fixado em uma revisao segura posterior ao incidente de supply chain de marco de 2026.
- O scan verifica pacotes do sistema operacional e bibliotecas, bloqueando vulnerabilidades High/Critical que possuam correcao.
- O estagio final da imagem fixa uma versao corrigida do npm compativel com Node.js 22, pois o npm fornecido pela imagem base tambem faz parte da superficie analisada pelo Trivy e e necessario em operacoes de producao.
- A tag oficial somente e criada depois que ambos os scans passam.

## Compose

O Compose base referencia, para API e worker:

```text
ghcr.io/danzstk/personal-finance-backend:${APP_VERSION}
```

A expressao usa a forma obrigatoria do Compose, produzindo erro se `APP_VERSION` estiver ausente ou vazia. O `build` sai do arquivo base para impedir compilacao acidental no host de producao.

Os overrides preservam os outros ambientes:

- `docker-compose.dev.yml`: imagem, build e dependências locais, selecionado explicitamente com `-f`;
- `.github/compose/backend-ci.override.yml`: imagem e build descartaveis do smoke test.

`.env.exemple` documenta `APP_VERSION=local`; a fixture da CI declara `APP_VERSION=container-smoke`.

## Validacao

- Validar formatacao YAML e Markdown.
- Confirmar falha do Compose sem `APP_VERSION` em ambiente controlado.
- Validar o Compose base e cada combinacao de override com uma versao definida.
- Executar o smoke test existente para garantir build, migrations e health checks.
- A validacao real do manifest multi-arquitetura ocorrera na primeira GitHub Release depois que o workflow estiver na branch default.

## Rollback

Esta fase nao implanta a imagem. Uma publicacao incorreta deve ser corrigida por uma nova release, preservando rastreabilidade. Na futura fase de deploy, rollback significara restaurar uma `APP_VERSION` anterior e saudavel.

## Impactos

- Banco de dados, migrations e contratos HTTP: nenhum.
- Desenvolvimento local: passa a exigir `APP_VERSION=local` no ambiente de interpolacao do Compose.
- CI: o override passa a declarar explicitamente o build removido do Compose base.
- Producao: ainda nao e alterada; apenas o artefato implantavel passa a ser publicado.
