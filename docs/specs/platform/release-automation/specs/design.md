# Automacao De Release — Design

## Arquitetura

A automacao permanece separada em tres responsabilidades:

```text
backend-ci.yml       -> valida o codigo
release-please.yml   -> mantem PR, versao, changelog, tag e GitHub Release
backend-cd.yml       -> publica a imagem; recebera o deploy remoto em seguida
```

`release-please.yml` executa em todo push para `main`. Como a ruleset exige pull request, esse push e o resultado de um merge aprovado.

## Autenticacao E Permissoes

O workflow cria um token de instalacao de curta duracao com `actions/create-github-app-token`, usando:

- variable `RELEASE_APP_CLIENT_ID`;
- secret `RELEASE_APP_PRIVATE_KEY`.

O token e limitado a escrita de contents, issues e pull requests. O `GITHUB_TOKEN` do workflow permanece com `contents: read` e nao e usado pelo Release Please. Isso permite que a PR e a GitHub Release criadas pela App iniciem workflows posteriores.

As actions que recebem a chave da App ou o token gerado sao fixadas por SHA completo para impedir alteracao implicita do codigo executado por tags moveis.

## Estrategia De Release

O repositorio e tratado como um unico componente com estrategia `simple` na raiz. Essa escolha inclui no historico da release commits que alterem API, Compose, workflows ou outras partes operacionais do backend.

A configuracao produz:

- `CHANGELOG.md` na raiz;
- tags `vX.Y.Z` sem prefixo de componente;
- GitHub Releases publicadas, nao drafts e nao prereleases;
- primeira versao `0.1.0`;
- atualizacao de `api/package.json` e dos campos `version` e `packages[""].version` do lockfile.

O manifest inicia vazio porque ainda nao existe tag no repositorio. Depois da primeira PR de release, ele passa a registrar a ultima versao liberada.

## Fluxo

```text
PR develop -> main
       |
       v
push em main
       |
       v
Release Please cria/atualiza PR de release -> main
       |
       v
CI + revisao + merge pelo maintainer
       |
       v
Release Please cria v0.1.0 + GitHub Release publicada
       |
       v
backend-cd.yml recebe release.published e publica a imagem multi-arquitetura
```

## Concorrencia E Recuperacao

Execucoes obsoletas para a mesma referencia sao canceladas. `workflow_dispatch` permite reexecutar a reconciliacao manualmente sem criar uma segunda implementacao do processo.

## Impactos

- Banco de dados e API: nenhum.
- Imagem Docker e deploy: nenhum nesta fase.
- Repositorio: novos arquivos de configuracao e futura manutencao automatica do changelog e versoes Node.
- Rulesets: a GitHub App deve estar instalada no repositorio e autorizada a criar PRs, contents, tags e releases conforme as regras aplicadas.
