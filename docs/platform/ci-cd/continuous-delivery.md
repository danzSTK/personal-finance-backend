---
area: platform
type: operations
status: current
related:
  - ../specs/platform/release-automation/specs/design.md
  - ../specs/platform/container-publication/specs/design.md
  - ../specs/platform/production-deploy/specs/design.md
  - ../deploy.md
---

# Releases e entrega contínua

O fluxo de entrega separa preparação de versão, publicação do artefato e implantação. As fontes executáveis são `.github/workflows/release-please.yml` e `.github/workflows/backend-cd.yml`.

## Visão geral

```text
merge em main
    |
    v
Release Please atualiza a PR de release
    |
    v
maintainer revisa e faz merge
    |
    v
tag vX.Y.Z + GitHub Release
    |
    v
build e scan AMD64/ARM64
    |
    v
manifest OCI publicado por digest
    |
    v
aprovação do Environment production
    |
    v
deploy privado via Tailscale
    |
    v
readiness pública ou rollback
```

## 1. Preparação da release

Em cada push para `main`, o Release Please analisa Conventional Commits desde a última versão e cria ou atualiza uma PR de release.

Essa PR mantém:

- `CHANGELOG.md`;
- versão de `api/package.json`;
- versão de `api/package-lock.json`;
- próxima tag SemVer.

O repositório é tratado como um único componente e as tags seguem `vX.Y.Z`. Não há merge automático: a PR passa por CI e revisão normal. Quando ela é mesclada, a automação publica a tag e a GitHub Release.

A autenticação usa uma GitHub App de curta duração. Isso permite que o evento da release inicie o workflow seguinte sem armazenar um personal access token.

## 2. Build e análise da imagem

Uma GitHub Release publicada e que não seja prerelease inicia o Backend CD. A tag é validada antes do build.

Duas variantes são construídas em runners nativos:

- `linux/amd64`;
- `linux/arm64`.

Cada variante é enviada ao GHCR inicialmente apenas por digest e analisada pelo Trivy. Vulnerabilidades corrigíveis `HIGH` ou `CRITICAL` em pacotes do sistema ou bibliotecas reprovam o job.

As tags oficiais só são criadas quando as duas arquiteturas passam. Isso impede que uma variante não analisada seja exposta como release válida.

## 3. Publicação no GHCR

Os dois digests aprovados formam um manifest OCI multi-arquitetura com:

```text
ghcr.io/danzstk/personal-finance-backend:vX.Y.Z
ghcr.io/danzstk/personal-finance-backend:sha-<7-caracteres>
```

Não existe tag `latest`. O workflow verifica que o manifest contém AMD64 e ARM64 e entrega ao deploy uma referência imutável:

```text
ghcr.io/danzstk/personal-finance-backend@sha256:<digest>
```

API e worker usam exatamente a mesma imagem.

## 4. Aprovação e acesso à produção

O job `deploy-production` usa o GitHub Environment `production`. As regras desse Environment controlam aprovação e acesso aos secrets.

Antes de conectar, o workflow valida:

- digest da imagem;
- versão SemVer;
- commit completo;
- host de produção;
- usuário remoto `deploy`;
- URL pública `https://api.danfy.app`.

O runner recebe identidade efêmera por OIDC, entra na rede Tailscale com `tag:github-deploy` e acessa o host sem chave SSH persistente ou porta SSH pública.

## 5. Deploy remoto

O workflow não manipula Docker diretamente no host. Ele chama o executor restrito:

```text
/usr/local/sbin/danfy-backend-deploy
```

O executor pertence ao repositório de infraestrutura e recebe imagem por digest, versão e commit. A credencial temporária do GHCR atravessa somente `stdin`.

No host, o executor é responsável por:

1. validar o artefato e seus metadados;
2. baixar a imagem;
3. executar migrations;
4. ativar API e worker;
5. verificar containers e health checks internos;
6. atualizar o estado implantado;
7. aplicar sua política interna de rollback em falha.

Deploys são serializados. Uma nova release espera a implantação em andamento terminar; ela não cancela uma migration ou ativação já iniciada.

## 6. Readiness e rollback

Depois do sucesso remoto, o runner consulta:

```text
https://api.danfy.app/health/readiness
```

O check usa TLS normal pela rota pública. Se apenas essa validação externa falhar, o workflow tenta:

```text
danfy-backend-deploy rollback previous
```

A falha original continua vermelha, mesmo que o rollback seja concluído. Migrations não são revertidas automaticamente; por isso alterações de banco devem ser compatíveis com a versão anterior durante a janela de rollback.

## Diagnóstico

Após conectar ao Tailscale, o workflow tenta coletar o estado remoto em sucesso ou falha. Os artefatos temporários podem conter:

- `deploy.log`;
- `rollback.log`, quando aplicável;
- `deployment-status.json`.

A retenção atual é de sete dias. Tokens não devem aparecer nesses arquivos.

O workflow manual `production-connectivity.yml` valida separadamente identidade Tailscale, privilégios restritos e leitura do status do executor sem realizar deploy.

## Estado atual e limites

- somente releases estáveis disparam o CD;
- não existe tag `latest`;
- o runtime usa digest imutável;
- não há reversão automática de migrations;
- não há atualmente um ambiente de staging automatizado neste repositório;
- o deploy real depende da configuração do Environment e do executor mantido no repositório de infraestrutura.

## Manutenção

Ao alterar o pipeline:

1. atualize requirements, design, tasks e decisions da spec afetada;
2. preserve a separação entre CI, release e CD;
3. mantenha actions sensíveis fixadas por SHA completo;
4. mantenha permissões mínimas por job;
5. não exponha tokens em argumentos, arquivos ou logs;
6. preserve builds e scans das duas arquiteturas;
7. implante somente por digest;
8. valide migrations quanto à compatibilidade de rollback;
9. alinhe mudanças do workflow com o executor em `danfy-infra`;
10. execute o teste manual de conectividade quando identidade, ACLs ou privilégios mudarem;
11. atualize este documento e o [guia de deploy](../deploy.md).

## Configuração necessária no GitHub

O fluxo depende, no mínimo, de:

- `RELEASE_APP_CLIENT_ID`;
- `RELEASE_APP_PRIVATE_KEY`;
- `TS_OAUTH_CLIENT_ID`;
- `TS_AUDIENCE`;
- `PRODUCTION_HOST`;
- `PRODUCTION_SSH_USER`;
- `PRODUCTION_URL`;
- regras e aprovadores do Environment `production`.

Os nomes e o local exato — variable ou secret — devem continuar coerentes com os workflows versionados.
