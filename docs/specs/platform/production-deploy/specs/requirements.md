# Deploy De Produção — Requisitos

## Objetivo

Concluir o continuous deployment da issue 38 implantando automaticamente em produção o manifest multi-arquitetura publicado para uma GitHub Release estável.

## Contexto

- `backend-cd.yml` publica `ghcr.io/danzstk/personal-finance-backend:vX.Y.Z` depois dos scans AMD64 e ARM64.
- O executor remoto pertence ao repositório `danzSTK/danfy-infra` e está instalado em `/usr/local/sbin/danfy-backend-deploy`.
- O acesso ao host usa OIDC GitHub → Tailscale, sem chave SSH persistente.
- O Environment `production` possui aprovação, secrets Tailscale e variables do host.

## Escopo

- Resolver a tag publicada para o digest do manifest OCI.
- Serializar deploys de produção sem cancelar uma execução em andamento.
- Conectar ao host por Tailscale SSH como `deploy`.
- Enviar credencial temporária do GHCR pelo stdin.
- Executar o deploy remoto com imagem, versão e commit validados.
- Validar readiness externamente com TLS normal.
- Executar rollback para `previous` quando somente a validação externa falhar.
- Coletar saída do deploy e estado remoto mesmo em falhas.

## Fora Do Escopo

- Reverter migrations automaticamente.
- Implantar prereleases.
- Usar tag mutável como referência de runtime.
- Abrir SSH público ou armazenar uma chave SSH.
- Executar o deploy durante a validação desta PR.
- Substituir a aprovação configurada no Environment `production`.

## Requisitos Funcionais

1. WHEN o manifest da release for publicado e verificado, THE SYSTEM SHALL obter seu digest `sha256`.
2. WHEN o job de produção iniciar, THE SYSTEM SHALL usar `ghcr.io/danzstk/personal-finance-backend@sha256:<64 hex>` como referência candidata.
3. WHEN dois deploys de produção coincidirem, THE SYSTEM SHALL enfileirar o segundo sem cancelar o primeiro.
4. WHEN o runner solicitar acesso Tailscale, THE SYSTEM SHALL usar `tag:github-deploy` e o Environment `production`.
5. WHEN o comando remoto iniciar, THE SYSTEM SHALL enviar ator e `GITHUB_TOKEN` somente pelo stdin.
6. WHEN o executor for chamado, THE SYSTEM SHALL informar a tag SemVer da release e o SHA Git completo associado à release.
7. IF o deploy remoto falhar, THEN o job SHALL falhar e o executor SHALL aplicar sua política interna de rollback.
8. WHEN o deploy remoto terminar com sucesso, THE SYSTEM SHALL testar `${PRODUCTION_URL}/health/readiness` com TLS normal.
9. IF a readiness externa falhar após deploy remoto bem-sucedido, THEN o workflow SHALL tentar `rollback previous` e continuar vermelho.
10. WHEN o job terminar com sucesso ou falha após conectar ao Tailscale, THE SYSTEM SHALL coletar `status` remoto.
11. WHEN houver saída de deploy, rollback ou status, THE SYSTEM SHALL preservá-la como artefato temporário sem incluir credenciais.

## Casos Limite

- Falha antes do comando remoto não executa rollback às cegas.
- O primeiro deploy gerenciado pode não possuir `previous`; nesse caso, uma falha externa exige intervenção e o workflow permanece vermelho.
- A tag da release não é usada diretamente pelo Compose de produção.
- Uma release publicada por GitHub App pode produzir um ator sintético terminado em `[bot]`.
- O token não pode aparecer em argumentos SSH, arquivos de state, artefatos ou logs.

## Critérios De Aceite

- `deploy-production` depende de `publish-manifest`.
- O job possui `environment: production`, `id-token: write`, `packages: read`, timeout e concurrency sem cancelamento.
- O manifest digest é validado antes do SSH.
- A Action do Tailscale está fixada por SHA completo.
- O executor recebe exatamente `deploy <image@digest> <version> <commit>`.
- Readiness externa e rollback condicional estão implementados.
- Status e logs são coletados com `always()`.
- Prettier e `actionlint` aprovam o workflow.
