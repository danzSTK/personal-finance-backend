---
area: assets
feature: asset-reconciler
type: spec-decisions
status: approved
issue: 127
related:
  - ./requirements.md
  - ./design.md
  - ./tasks.md
---

# Decisions — Asset Reconciler

## DEC-001 - Poller intervalar com `setInterval` em vez de fila agendada BullMQ

Status: accepted

Decision:
Executar o ciclo de reconciliação através de um timer intervalar (`setInterval` desreferenciado com `unref()`) direto no processo Worker, espelhando a arquitetura de `EmailMessageEnqueueReconciler` e `OutboxProcessorService`.

Reason:
BullMQ exige conexão com Redis, prefixos de fila e overhead de agendamento repetitivo (`repeat`). O reconciliador precisa apenas consultar periodicamente o PostgreSQL via índice parcial e executar I/O no R2. O modelo `setInterval` com controle de `isDraining` e `isRunning` é mais simples, determinístico e não cria dependência do Redis para desalocação de arquivos.

Impact:
Menor consumo de memória e conexões no Redis. O Worker mantém o ciclo de forma autônoma.

---

## DEC-002 - Quarentena de erros do R2 via `metadata` JSONB sem alterar schema

Status: accepted

Decision:
Armazenar a contagem de falhas consecutivas (`delete_attempts`) e a marcação de quarentena (`quarantine = true`) dentro da coluna JSONB `metadata` da tabela `assets`.

Reason:
A constraint do PostgreSQL `CHK_assets_status` aceita apenas `'PENDING_UPLOAD', 'READY', 'DELETE_PENDING', 'DELETED', 'FAILED'`. Criar um status `QUARANTINE` ou adicionar colunas físicas exigiria uma migration e alteração de constraints. Como `metadata` já existe com índice e validação `jsonb_typeof = 'object'`, utilizá-lo evita migrations adicionais e isola o estado operacional do contrato de domínio.

Impact:
A query de seleção filtra `AND (metadata->>'quarantine' IS NULL OR metadata->>'quarantine' = 'false')`. Nenhuma migration é necessária para o rollout desta feature.

---

## DEC-003 - Janela de carência (*grace period*) de 30 segundos para `DELETE_PENDING`

Status: accepted

Decision:
Apenas assets com `updated_at < NOW() - INTERVAL '30 seconds'` são elegíveis para exclusão no R2.

Reason:
Evita concorrência e race condition com transações HTTP do NestJS. Quando um caso de uso muda um asset para `DELETE_PENDING`, a transação do PostgreSQL pode levar alguns milissegundos para comitar ou a aplicação pode estar finalizando I/O. A janela de 30 segundos garante que o reconciliador nunca tente excluir um asset antes da transação estar 100% consolidada.

Impact:
A desalocação física no bucket ocorre entre 30 e 90 segundos após o comando de exclusão na API, tempo perfeitamente aceitável para remoção de bytes.

---

## DEC-004 - Transição de uploads abandonados para `FAILED` com `UPLOAD_TIMEOUT`

Status: accepted

Decision:
Assets em `PENDING_UPLOAD` há mais de 2 horas são transicionados para `FAILED` preenchendo `failure_code: 'UPLOAD_TIMEOUT'`.

Reason:
A entidade `Asset` possui o método `markFailed(failureCode)` que exige explicitamente que o asset esteja em `PENDING_UPLOAD`. A constraint `CHK_assets_failure_state` exige `status = 'FAILED' AND failure_code IS NOT NULL`. Usar `markFailed('UPLOAD_TIMEOUT')` segue estritamente as regras de domínio existentes e libera cotas de uploads concorrentes.

Impact:
Evita acúmulo infinito de linhas em `PENDING_UPLOAD` caso um cliente feche o navegador no meio do upload.

---

## DEC-005 - Separação em `AssetsWorkerModule` exclusivo para o processo Worker

Status: accepted

Decision:
Criar `AssetsWorkerModule` (`api/src/modules/assets/assets-worker.module.ts`) para prover o `AssetReconcilerService` e importá-lo apenas em `WorkerModule`, mantendo `AssetsCoreModule` sem serviços de background.

Reason:
`AssetsCoreModule` é importado por `AssetsModule` -> `UsersCoreModule` -> `ApiModule`. Se `AssetReconcilerService` fosse registrado em `AssetsCoreModule`, o poller `setInterval` também seria iniciado dentro do processo da API HTTP.

Impact:
Isola a execução do reconciliador estritamente no processo `worker`, seguindo o mesmo padrão de `NotificationsWorkerModule`.

---

## DEC-006 - Claim em transação curta antes de I/O externo no R2

Status: accepted

Decision:
Executar `FOR UPDATE SKIP LOCKED` dentro de uma transação curta de banco em `findPendingDeletionBefore` que já atualiza `updated_at = NOW()` nos registros selecionados antes de fechar a transação e retornar o lote ao reconciliador.

Reason:
O PostgreSQL exige uma transação aberta para `FOR UPDATE SKIP LOCKED`, mas manter uma transação aberta durante 50 chamadas HTTP externas ao Cloudflare R2 prenderia conexões do pool e locks de linha sob latência de rede. Ao atualizar `updated_at = NOW()` no claim e comitar imediatamente, as linhas ficam protegidas pela janela de carência contra outros workers sem segurar transação aberta durante o I/O no R2.

Impact:
Transações de banco duram poucos milissegundos e chamadas ao R2 ocorrem fora de lock transacional.

---

## DEC-007 - Isolamento de `try/catch` entre exclusão no R2 e persistência de `DELETED`

Status: accepted

Decision:
Separar o bloco `try/catch` da chamada `objectStorage.deleteObject()` do bloco `try/catch` que executa `asset.markDeleted()` e `assetRepository.save(asset)`.

Reason:
Se `deleteObject()` tiver sucesso, `asset.markDeleted()` altera o status da entidade em memória para `DELETED`. Caso `assetRepository.save(asset)` lance uma exceção de banco no mesmo bloco `try`, o `catch` invocaria `asset.recordDeleteFailure()`, que exige `status === DELETE_PENDING` e lançaria `InvalidAssetStateTransitionError` não tratado, abortando todo o restante do lote. Além disso, uma falha de banco após o objeto já ter sido removido do R2 não deve ser contabilizada como falha de comunicação com o R2 rumo à quarentena.

Impact:
Preserva o isolamento de falhas do lote mesmo diante de instabilidades do PostgreSQL após a exclusão no R2.
