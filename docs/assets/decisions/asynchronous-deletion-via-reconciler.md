---
area: assets
type: decision
status: current
related:
  - ../concepts/asset-status.md
  - ../flows/delete-asset.md
  - ../flows/reconcile-assets.md
---

# Desalocação Física Assíncrona Via Reconciliador

## Decisão

Módulos consumidores desvinculam o asset e marcam seu estado como `DELETE_PENDING` na mesma transação PostgreSQL da operação de negócio. A exclusão física no Object Storage (Cloudflare R2) e a transição para `DELETED` são delegadas exclusivamente ao serviço em background `AssetReconcilerService` no Worker.

## Motivos

1. **Desacoplamento de Domínio:** Entidades como `User` e `Transaction` não devem acoplar seu ciclo de vida com chamadas de rede ao Cloudflare R2 ou emitir mensagens de Transactional Outbox dedicadas apenas à infraestrutura de arquivos.
2. **Atomicidade no PostgreSQL:** Se a transação do banco falhar, o status do asset não muda para `DELETE_PENDING`. Se confirmar, o asset já deixa de ser exposto nas consultas da aplicação imediatamente.
3. **Resiliência a Falhas do Provedor:** Indisponibilidades transitórias do Cloudflare R2 não afetam a disponibilidade da API nem bloqueiam o fluxo de negócio do usuário; o reconciliador no Worker aplica retries com backoff até o limite de quarentena.
4. **Reaproveitamento de Índice de Banco:** O schema já possui o índice parcial `idx_assets_status_updated_at` (`WHERE status IN ('PENDING_UPLOAD', 'DELETE_PENDING', 'FAILED')`), desenhado especificamente para suportar essa varredura com impacto desprezível de I/O.
