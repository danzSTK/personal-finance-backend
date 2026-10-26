---
area: assets
type: decision
status: current
related:
  - ../concepts/asset-status.md
  - ../flows/delete-asset.md
  - ../flows/reconcile-assets.md
  - ../reference/invariants.md
---

# Desalocação Física Assíncrona Via Reconciliador

## Decisão

Módulos consumidores desvinculam o asset e marcam seu estado como `DELETE_PENDING` na mesma transação PostgreSQL da operação de negócio. A exclusão física no Object Storage (Cloudflare R2) e a transição para `DELETED` são delegadas exclusivamente ao serviço em background `AssetReconcilerService` no Worker.

---

## Comparativo de Alternativas Avaliadas

| Dimensão | Opção A: Exclusão Síncrona na API | Opção B: Evento na Outbox por Exclusão | Opção C: Reconciliador por Status (Escolhida) ✅ |
|:---|:---|:---|:---|
| **Latência HTTP** | Alta (espera chamada externa ao R2) | Quase nula (grava na tabela outbox) | **Nula** (apenas UPDATE local no PostgreSQL) |
| **Resiliência a Queda do R2** | Nula (falha a requisição do usuário ou deixa objeto órfão) | Média (outbox faz retries até 10x, depois mensagem vira DEAD) | **Alta** (poller repete com backoff e quarentena segura) |
| **Acoplamento Entre Módulos** | Altíssimo (API conhece SDK de storage) | Alto (cada módulo cria eventos e handlers dedicados de deleção) | **Nulo** (módulos só conhecem `status = DELETE_PENDING`) |
| **Complexidade de Mensageria** | Nenhuma | Alta (`EventRegistry`, reidratadores, `outbox_messages`, lease renewal) | **Mínima** (poller com `FOR UPDATE SKIP LOCKED` e timer) |
| **Proteção de Custo / Concorrência R2** | Nenhuma (pico de exclusões gera pico de chamadas S3) | Difícil controle de taxa (depende de concorrência outbox) | **Excelente** (lote fixo de 50 itens a cada 60s) |
| **Tratamento de Órfãos / Falhas Anteriores** | Não resolve (precisaria de um cron separado de qualquer forma) | Não resolve (mensagens DEAD viram órfãos permanentes) | **Nativo** (mesmo poller atua como safety net universal) |

---

## Motivos Detalhados

1. **Desacoplamento Radical de Domínio:** Entidades como `User` e `Transaction` não devem conhecer SDK S3 nem ser obrigadas a publicar eventos de infraestrutura na Transactional Outbox apenas para limpar arquivos físicos.
2. **Atomicidade Pura no PostgreSQL:** Quando uma transação financeira é soft-deletada, o update de seus anexos para `DELETE_PENDING` ocorre na mesma transação. Se o rollback acontecer, o arquivo não é perdido. Se o commit acontecer, o arquivo é imediatamente invisível para o usuário.
3. **Aproveitamento de Índice de Banco Pré-existente:** A migration original da Danfy (`1778800000000-CreateAssets.ts`) já criou o índice parcial:
   ```sql
   CREATE INDEX "idx_assets_status_updated_at" ON "assets" ("status", "updated_at")
   WHERE "status" IN ('PENDING_UPLOAD', 'DELETE_PENDING', 'FAILED');
   ```
   A Opção C aproveita uma estrutura de banco que já foi projetada para isso, sem necessidade de novas migrations.
4. **Proteção Contra Erros em Cascata no Storage:** Se o Cloudflare R2 sofrer uma degradação de 30 minutos:
   - Na Opção B, milhares de mensagens iriam para a tabela `outbox_messages`, atingiriam o teto de 10 tentativas e passariam para `DEAD`, exigindo intervenção manual complexa no banco de outbox.
   - Na Opção C, o reconciliador simplesmente falha naquele ciclo, rotaciona os itens via `updated_at` e retoma normalmente assim que o R2 se restabelecer.

---

## Trade-offs e Riscos Aceitos

- **Latência de Remoção Física:** A remoção dos bytes no R2 ocorre entre 30 e 90 segundos após o comando de exclusão (devido ao grace period de 30s e ao ciclo de 60s). Para arquivos não utilizados, esse atraso é completamente inofensivo e tem impacto financeiro de storage virtualmente nulo.
- **Quarentena Manual:** Registros com falhas repetidas (>= 5) param de ser tentados automaticamente para não sobrecarregar logs e conexões de rede, exigindo observabilidade estruturada (`[ASSET_DELETE_QUARANTINED]`).
