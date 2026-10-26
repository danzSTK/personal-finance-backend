---
area: assets
type: flow
status: current
related:
  - ../concepts/asset-status.md
  - ../decisions/asynchronous-deletion-via-reconciler.md
  - ./delete-asset.md
  - ../reference/invariants.md
---

# Reconcile Assets

O serviço `AssetReconcilerService` no Worker é o motor de execução contínua que mantém a consistência eventual entre a tabela `assets` no PostgreSQL e os objetos no Cloudflare R2.

Ele consome o índice parcial:

```sql
CREATE INDEX "idx_assets_status_updated_at"
ON "assets" ("status", "updated_at")
WHERE "status" IN ('PENDING_UPLOAD', 'DELETE_PENDING', 'FAILED');
```

---

## 1. Fluxo de Desalocação Física (`DELETE_PENDING`)

### 1.1. Gatilho e Agendamento
- **Frequência:** Executado a cada 60 segundos (`ASSET_RECONCILER_INTERVAL_MS`).
- **Garantia de Não-Sobreposição:** Se um ciclo anterior ainda estiver em execução (`isRunning = true`), o novo ciclo é ignorado para não sobrecarregar I/O.
- **Desligamento Seguro:** Em caso de `SIGTERM`, o reconciliador ativa `isDraining = true`, cancela o timer e aguarda a finalização do lote em curso antes de liberar o processo.

### 1.2. Passo a Passo do Ciclo
1. **Cálculo da Janela de Carência:** Define `cutoff = now() - 30 seconds`.
2. **Seleção com Concorrência Segura:**
   ```sql
   SELECT id, bucket, storage_key, metadata, status, updated_at
   FROM assets
   WHERE status = 'DELETE_PENDING'
     AND updated_at < :cutoff
     AND (metadata->>'quarantine' IS NULL OR metadata->>'quarantine' = 'false')
   ORDER BY updated_at ASC
   LIMIT 50
   FOR UPDATE SKIP LOCKED;
   ```
   *Nota:* O `SKIP LOCKED` permite que, em uma eventual topologia com múltiplos containers de worker, cada container processe um lote distinto sem bloquear os demais nem duplicar chamadas ao R2.
3. **Desalocação Idempotente:** Para cada asset selecionado, chama `IObjectStorage.deleteObject({ bucket: asset.bucket, key: asset.storageKey })`.
4. **Resolução de Sucesso:**
   - Se o objeto foi excluído com sucesso ou se o R2 retornou que o arquivo não existe mais (404 / `NotFound`), a remoção é considerada concluída.
   - O asset executa `asset.markDeleted()` (preenchendo `deleted_at = now()`) e limpa possíveis dados residuais de erro em `metadata`.
   - O registro é persistido no banco com `status = 'DELETED'`.
5. **Resolução de Falha:**
   - Se o R2 retornar erro de rede, timeout ou erro 5xx, o erro é capturado de forma isolada sem abortar o restante do lote.
   - Incrementa `metadata.delete_attempts = (metadata.delete_attempts || 0) + 1`.
   - Registra `metadata.last_delete_error = error.message` e `metadata.last_delete_attempt_at = now()`.
   - Atualiza `updated_at = now()`, empurrando o item para o final da fila de prioridade cronológica.
   - **Quarentena:** Se `delete_attempts >= 5`, marca `metadata.quarantine = true` e emite log estruturado de nível `ERROR` (`[ASSET_DELETE_QUARANTINED]`), retirando o asset das próximas buscas automáticas.

---

## 2. Fluxo de Expiração de Uploads Abandonados (`PENDING_UPLOAD`)

### 2.1. Problema Mitigado
Quando um cliente HTTP inicia o processo de upload (reservando um asset no banco), mas aborta, fecha o navegador ou tem a conexão interrompida antes de enviar os bytes ao storage, o asset permaneceria indefinidamente em `PENDING_UPLOAD`.

Isso geraria:
- Linhas órfãs perpétuas no PostgreSQL;
- Ocupação indevida de slots de regras de negócio (como o limite de 3 anexos ativos por transação).

### 2.2. Passo a Passo da Expiração
1. **Cálculo de Inatividade:** Define `staleCutoff = now() - 2 hours`.
2. **Seleção de Abandonados:**
   ```sql
   SELECT id, status, updated_at
   FROM assets
   WHERE status = 'PENDING_UPLOAD'
     AND updated_at < :staleCutoff
   ORDER BY updated_at ASC
   LIMIT 50
   FOR UPDATE SKIP LOCKED;
   ```
3. **Transição Terminal:** Para cada asset localizado:
   - Executa `asset.markFailed('UPLOAD_TIMEOUT')`.
   - Persiste no banco com `status = 'FAILED'`, liberando imediatamente as validações de limite de uploads ativos da entidade de negócio.

---

## 3. Matriz de Resiliência a Falhas

| Evento | Impacto na Aplicação | Recuperação pelo Reconciliador |
|:---|:---|:---|
| R2 fora do ar por 15 minutos | Nenhum impacto na API | O worker falha os itens, incrementa tentativas e retenta com backoff no ciclo seguinte após a volta do R2 |
| Objeto deletado manualmente no R2 | Nenhum | O adapter trata 404 como sucesso idempotente e transiciona para `DELETED` |
| Queda repentina do container Worker | Nenhum | Graças ao `SKIP LOCKED`, o lock é liberado pelo PostgreSQL; o próximo ciclo ou container retoma os itens pendentes |
| Chave de acesso do R2 revogada | Alerta após 5 tentativas | Os assets entram em quarentena (`quarantine = true`) sem travar a CPU do worker nem inundar os logs |
