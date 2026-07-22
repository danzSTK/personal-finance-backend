# Deploy De Produção — Design

## Arquitetura

```text
release.published
  -> build + scan AMD64/ARM64
  -> publicar manifest e capturar digest
  -> aguardar aprovação do Environment production
  -> OIDC/Tailscale SSH
  -> executor remoto deploy
  -> readiness pública
  -> sucesso ou rollback previous
```

O workflow do backend apenas orquestra. Pull, validação dos labels OCI, migrations, ativação, checks internos, estado e rollback pertencem ao executor versionado no `danfy-infra`.

## Digest E Metadados

`docker buildx imagetools create --metadata-file` registra o descriptor criado. O job extrai `containerimage.descriptor.digest`, valida `sha256:<64 hex>` e expõe:

- `image-ref`: nome completo por digest;
- `release-version`: `github.event.release.tag_name`;
- `release-commit`: `github.sha`, que no evento de release representa o último commit da tag.

O executor na VM confirma novamente os labels `org.opencontainers.image.version` e `org.opencontainers.image.revision`.

## Segurança

- Job com `contents: read`, `packages: read` e `id-token: write`.
- Secrets Tailscale disponíveis somente pelo Environment `production`.
- `GITHUB_TOKEN` e nome do ator atravessam stdin e não aparecem na linha de comando.
- Referências, URL, host e usuário remoto são validados antes do deploy.
- Todas as sessões remotas usam `tailscale ssh`, que valida a chave SSH anunciada pelo nó no control plane e funciona em runners efêmeros sem desabilitar a verificação de host.
- O usuário remoto continua sem grupo Docker e com sudo restrito ao executor.
- A tag Tailscale do runner continua `tag:github-deploy`.

O executor aceita nomes normais do GitHub e o sufixo sintético `[bot]`, necessário quando uma GitHub App publica a release. Isso não amplia comandos permitidos nem a validação do artefato.

## Concorrência E Timeout

O build pode ocorrer por release, mas o job de deploy usa o grupo fixo `production-backend-deploy` com `cancel-in-progress: false`. Assim, releases concorrentes aguardam em vez de interromper uma migration ou ativação.

O timeout do job limita conexão, deploy, health check e diagnóstico. O host mantém um segundo controle de exclusividade por `flock`.

## Saúde E Rollback

O executor só retorna sucesso depois de verificar containers, worker, liveness, readiness e NGINX local. Em seguida o runner chama a URL pública com TLS normal.

Se apenas esse check externo falhar, um step com `always()` e condições sobre os outcomes chama `rollback previous` usando uma nova sessão efêmera de registry. A falha original permanece como resultado do job. Se não existir estado anterior, o rollback falha explicitamente e exige intervenção.

## Diagnóstico

A saída do deploy é gravada em `deploy.log`; rollback em `rollback.log`; o comando remoto `status` produz `deployment-status.json`. Um artifact de retenção curta é enviado com `always()`. O token percorre apenas stdin e o executor nunca o imprime.

## Validação

- Prettier para YAML e Markdown.
- `actionlint` e ShellCheck embutido para expressões e scripts.
- testes do executor, incluindo usuário GitHub App terminado em `[bot]`.
- nenhuma execução real antes do workflow chegar à `main` e receber aprovação do Environment.
