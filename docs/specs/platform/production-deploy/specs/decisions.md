# Deploy De Produção — Decisões

## DEC-001 - Implantar O Mesmo Manifest Aprovado

Status: accepted

Decision:
O job de publicação exporta o digest retornado pelo próprio `imagetools create`; o deploy usa esse digest, nunca resolve novamente uma tag mutável na VM.

Reason:
Garante que o artefato implantado é exatamente o manifest AMD64/ARM64 montado depois dos scans.

Impact:
A versão permanece metadado e a referência de runtime é imutável.

## DEC-002 - Manter Build E Deploy No Mesmo Workflow

Status: accepted

Decision:
`deploy-production` depende diretamente de `publish-manifest` em `backend-cd.yml`.

Reason:
O digest trafega como output do job, sem evento intermediário ou nova resolução de tag.

Impact:
O Environment pode pausar somente o job de deploy enquanto build e publicação já terminaram.

## DEC-003 - Dupla Exclusividade

Status: accepted

Decision:
Usar concurrency fixo no job de produção e `flock` no executor.

Reason:
GitHub serializa execuções normais; a VM também se protege contra workflows manuais ou operadores concorrentes.

Impact:
Uma release nova aguarda o deploy anterior e nunca o cancela.

## DEC-004 - Rollback Externo Condicional

Status: accepted

Decision:
Chamar `rollback previous` somente quando o deploy remoto teve sucesso e a readiness pública falhou.

Reason:
O executor já trata falhas internas. Um erro anterior à ativação não autoriza alterar uma aplicação saudável.

Impact:
O primeiro deploy, sem estado anterior, pode exigir intervenção explícita.

## DEC-005 - Preservar Diagnóstico No GitHub

Status: accepted

Decision:
Enviar como artifact de curta retenção a saída do executor e o JSON de status coletados com `always()`.

Reason:
Permite diagnóstico sem conceder acesso Docker ou SSH adicional ao runner.

Impact:
Credenciais continuam fora dos logs porque atravessam apenas stdin.

## DEC-006 - Validar O Host Remoto Pelo Tailscale SSH

Status: accepted

Decision:
Executar todas as sessões remotas com `tailscale ssh` em vez de desabilitar `StrictHostKeyChecking` ou confiar em um `known_hosts` preenchido durante o job.

Reason:
O runner de produção é efêmero e inicia sem chaves conhecidas. O wrapper valida automaticamente a chave SSH do destino contra a chave anunciada pelo nó no control plane do Tailscale.

Impact:
O deploy preserva verificação de identidade do host sem armazenar uma chave fixa no GitHub ou aceitar silenciosamente qualquer chave apresentada.

## DEC-007 - Delimitar Sessões Remotas Fora Do Wrapper SSH

Status: accepted

Decision:
Passar `usuário@host` como primeiro argumento de `tailscale ssh` e aplicar limites de duração com GNU `timeout`, sem opções OpenSSH `-o`. Ativar `pipefail` nas sessões cuja saída atravessa `tee`.

Reason:
O wrapper do Tailscale aceita o destino como primeiro argumento e configura internamente o OpenSSH seguro. Argumentos `-o` antes do destino são rejeitados pelo parser; depois do destino seriam interpretados como parte do comando remoto. Sem `pipefail`, o sucesso de `tee` poderia ocultar uma falha do executor.

Impact:
Conexões travadas são encerradas dentro do limite adequado a cada operação, e qualquer código não zero do Tailscale, SSH ou executor permanece visível ao GitHub Actions.
