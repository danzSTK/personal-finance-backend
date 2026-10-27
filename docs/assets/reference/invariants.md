---
area: assets
type: reference
status: current
related:
  - ../concepts/asset.md
  - ../concepts/asset-status.md
  - ../flows/reconcile-assets.md
  - ../decisions/asynchronous-deletion-via-reconciler.md
---

# Assets Invariants

Invariantes de integridade e regras não negociáveis que governam o módulo de assets na Danfy.

---

## 1. Invariantes de Dados e Identidade

1. **Unicidade de Localização:** A combinação `(bucket, storage_key)` é estritamente única no PostgreSQL (`UQ_assets_bucket_storage_key`). Dois assets distintos nunca podem apontar para o mesmo objeto no mesmo bucket.
2. **Formato Relativo da Storage Key:** A chave de storage nunca começa com barra (`/`), não é vazia e possui no máximo 1024 caracteres (`CHK_assets_storage_key`).
3. **Isolamento Multi-tenant Obrigatório:** Todo asset pertence a um `user_id` com chave estrangeira restrita (`FK_assets_user ON DELETE RESTRICT`). Nenhum asset pode existir sem proprietário.
4. **Contrato de Integridade de Bytes:**
   - Se `size_bytes` estiver preenchido, deve ser maior ou igual a zero (`CHK_assets_size_bytes`).
   - Se `checksum` estiver preenchido, deve ser rigorosamente uma string de 64 caracteres hexadecimais minúsculos correspondente ao SHA-256 (`CHK_assets_checksum`).

---

## 2. Invariantes da Máquina de Estados

1. **Prontidão (`READY`):** O status `READY` exige obrigatoriamente que `ready_at` esteja preenchido (`CHK_assets_ready_state`).
2. **Exclusão Confirmada (`DELETED`):**
   - O status `DELETED` exige obrigatoriamente que `deleted_at` esteja preenchido.
   - Nenhum asset em outro status pode possuir `deleted_at` não-nulo (`CHK_assets_deleted_state`).
3. **Falha de Inicialização (`FAILED`):**
   - O status `FAILED` exige obrigatoriamente um código de falha (`failure_code` não-nulo).
   - Nenhum asset fora de `FAILED` pode possuir `failure_code` (`CHK_assets_failure_state`).
4. **Transições Válidas de Domínio:** A entidade `Asset` rejeita qualquer transição fora do grafo permitido disparando `InvalidAssetStateTransitionError`:
   - Apenas `PENDING_UPLOAD` pode transicionar para `READY` ou `FAILED`.
   - Apenas `READY` e `FAILED` podem transicionar para `DELETE_PENDING`.
   - Apenas `DELETE_PENDING` pode transicionar para `DELETED`.

---

## 3. Invariantes de Reconciliação e Storage

1. **Janela de Carência (*Grace Period*):** Nenhum asset em `DELETE_PENDING` pode ser processado pelo reconciliador antes de 30 segundos após sua última atualização (`updated_at < NOW() - INTERVAL '30 seconds'`). Isso evita conflitos com transações PostgreSQL ainda abertas na API.
2. **Idempotência de Desalocação:** A remoção de um objeto inexistente no R2 (`NotFound` / 404) é tratada como sucesso e obrigatoriamente conclui a transição para `DELETED`.
3. **Teto de Retries e Quarentena:** Um asset em `DELETE_PENDING` que falhe 5 vezes consecutivas na desalocação física é marcado como `metadata.quarantine = true` e é removido da fila de varredura automática para evitar laços infinitos e custos de API.
4. **Desacoplamento de I/O em Transações de Negócio:** Módulos de negócio (`transactions`, `users`, etc.) nunca executam chamadas de rede ao Cloudflare R2 dentro de transações HTTP; apenas atualizam o status para `DELETE_PENDING`.
