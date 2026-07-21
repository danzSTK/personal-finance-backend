# Publicacao Da Imagem — Decisoes

## DEC-001 - Publicar Somente A Partir De GitHub Release

Status: accepted

Decision:
O workflow inicia em `release.published` e ignora prereleases.

Reason:
A GitHub Release representa a conclusao do versionamento pelo Release Please e identifica uma tag e um commit especificos.

Impact:
Pushes em branches ou tags avulsas nao publicam imagens.

## DEC-002 - Usar Um Manifest Multi-Arquitetura

Status: accepted

Decision:
Publicar um unico nome e versao contendo variantes `linux/amd64` e `linux/arm64`.

Reason:
O servidor de producao e ARM64, mas desenvolvimento e outros consumidores podem usar AMD64.

Impact:
Docker seleciona automaticamente a variante compativel durante o pull.

## DEC-003 - Usar Runners Nativos

Status: accepted

Decision:
Executar AMD64 em `ubuntu-24.04` e ARM64 em `ubuntu-24.04-arm`.

Reason:
Runners ARM64 padrao estao disponiveis para repositorios privados e evitam custo, lentidao e diferencas introduzidas por emulacao QEMU.

Impact:
Os builds executam em paralelo e consomem minutos de dois runners.

## DEC-004 - Publicar Digests Antes Das Tags Oficiais

Status: accepted

Decision:
Enviar cada variante por digest, escanea-la e criar as tags da release somente depois da aprovacao das duas arquiteturas.

Reason:
Um manifest multi-arquitetura nao pode ser carregado no Docker local padrao, e a montagem por digest evita rebuild e evita expor uma tag oficial antes do gate de seguranca.

Impact:
Uma falha pode deixar blobs sem tag no registry, mas nao cria `vX.Y.Z` nem `sha-*`.

## DEC-005 - Nao Publicar latest

Status: accepted

Decision:
Publicar somente a tag exata da release e uma tag do commit.

Reason:
Tags explicitas tornam deploy e rollback reproduziveis e impedem atualizacoes implicitas.

Impact:
Todo consumidor deve informar `APP_VERSION`.

## DEC-006 - Compose Base Nao Constroi Imagens

Status: accepted

Decision:
Remover `build` do Compose base e exigir a imagem GHCR com `APP_VERSION`; builds permanecem nos overrides local e da CI.

Reason:
O host de producao deve executar exatamente o artefato publicado e verificado, sem construir codigo local como fallback.

Impact:
Ambientes locais precisam do override e de `APP_VERSION=local`.

## DEC-007 - Fixar Actions Por SHA

Status: accepted

Decision:
Fixar por SHA completo todas as actions do workflow com permissao de escrita e tambem as actions do Release Please.

Reason:
Tags de actions sao referencias moveis. O incidente do Trivy em marco de 2026 demonstrou que ate tags existentes podem ser regravadas durante um comprometimento.

Impact:
Atualizacoes das actions passam a exigir revisao e troca explicita dos SHAs.
