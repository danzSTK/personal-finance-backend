---
area: transactions
type: flow
status: current
related:
  - ../concepts/transaction-type.md
  - ../decisions/adjustments-are-technical-transactions.md
  - ../../accounts/concepts/account-balance.md
  - ../../categories/decisions/categories.md
  - ../../integrations/transactions/create-balance-adjustment.md
  - ../../integrations/transactions/create-transaction.md
---

# Balance Adjustment

Registra uma correção técnica de saldo por meio de uma transaction `ADJUSTMENT`, preservando o histórico derivado sem alterar `initialBalanceCents`.

O domínio suporta dois modos de entrada, ambos produzindo uma transaction `ADJUSTMENT` com as mesmas invariantes:

- **Reajuste automático por saldo alvo (`POST /transactions/balance-adjustments`)**: o usuário informa o saldo real/desejado da account (`targetBalanceCents`) e o backend calcula automaticamente o delta e a `direction` com base no saldo atual derivado (`currentCents`).
- **Ajuste manual por delta (`POST /transactions`)**: o usuário informa explicitamente `type = ADJUSTMENT`, `amountCents > 0`, `direction` (`INCREASE` ou `DECREASE`) e `description`.

---

## Fluxo Principal — Reajuste Automático por Saldo Alvo

### Entrada Esperada

- `userId`: extraído exclusivamente da sessão autenticada;
- `accountId`: UUID de uma account ativa do usuário;
- `targetBalanceCents`: inteiro seguro em centavos (aceita valores negativos, zero ou positivos);
- `date`: data civil `DateOnly` (`YYYY-MM-DD`) no fuso do usuário;
- `description` (opcional): motivo do ajuste (máximo de 500 caracteres). Quando omitido, `null` ou vazio após `trim()`, o sistema aplica o padrão `"Reajuste de saldo"`.

### Passos Observáveis

1. O sistema valida o formato dos dados de entrada (incluindo que `targetBalanceCents` é um inteiro seguro e `date` é `DateOnly`).
2. Dentro de uma transação SQL:
   - adquire lock pessimista (`FOR UPDATE`) na linha da account filtrando por `id` e `user_id`;
   - valida que a account existe, pertence ao usuário autenticado e não está arquivada;
   - resolve internamente a category técnica ativa `ADJUSTMENT` do usuário;
   - calcula o saldo atual derivado (`currentCents`) da account usando apenas `initialBalanceCents` e transactions `EFFECTIVE` não deletadas (ignorando `PENDING` e `deleted_at IS NOT NULL`);
   - calcula `delta = BigInt(targetBalanceCents) - BigInt(currentCents)`.
3. Se `delta === 0`, nenhuma transaction é criada e o fluxo falha com `BALANCE_ADJUSTMENT_NO_DIFFERENCE` (`409 Conflict`).
4. Caso contrário:
   - `delta > 0` define `direction = INCREASE` e `amountCents = delta`;
   - `delta < 0` define `direction = DECREASE` e `amountCents = |delta|`;
   - valida que `amountCents <= TRANSACTION_AMOUNT_CENTS_MAX`.
5. Cria e persiste a transaction com `type = ADJUSTMENT`, `status = EFFECTIVE`, `effectiveAt = now` (UTC), `destinationAccountId = null`, `categoryId` técnico e `description` normalizada (ou fallback `"Reajuste de saldo"`).
6. Retorna `201 Created` com a transaction criada (`TransactionResponseDto`).

### Impacto No Saldo

- Como a transaction nasce como `EFFECTIVE`, ela passa a compor imediatamente o saldo atual (`currentCents`) e projeções futuras da account:
  - `INCREASE` soma `amountCents`;
  - `DECREASE` subtrai `amountCents`.
- O saldo derivado resultante após o commit passa a coincidir com `targetBalanceCents`.
- Transactions `ADJUSTMENT` não entram em listagens/resumos comuns de receitas e despesas (`INCOME`/`EXPENSE`).

### Concorrência e Falhas

- O lock pessimista `FOR UPDATE` nas linhas das accounts envolvidas (adquirido em ordem determinística de `id` via `AccountBalanceLockPort`) serializa o reajuste automático não apenas contra outros reajustes simultâneos (ex.: duplo clique), mas também contra todas as mutações concorrentes de `transactions` que alteram saldo (`POST /transactions`, `PATCH /transactions/:id`, `POST /transactions/:id/confirm` e `DELETE /transactions/:id`).
- Quando duas requisições de reajuste concorrem para o mesmo saldo alvo, a segunda enxergará `delta === 0` após o commit da primeira e responderá `409 Conflict` (`BALANCE_ADJUSTMENT_NO_DIFFERENCE`), evitando ajustes duplicados.
- Quando uma mutação de transação concorre com um reajuste na mesma conta, as operações executam em ordem serializada, impedindo que o reajuste calcule o delta sobre um saldo obsoleto.
- Se qualquer validação falhar dentro da transação SQL, ocorre rollback integral sem efeito colateral.

### Erros Possíveis

- `VALIDATION_ERROR` (`400`): payload inválido (`accountId`, `targetBalanceCents`, `date`, `description` ou campos extras).
- `INVALID_TRANSACTION` (`400`): `targetBalanceCents` fora de inteiro seguro ou `|delta|` acima do teto `TRANSACTION_AMOUNT_CENTS_MAX`.
- `TRANSACTION_CATEGORY_UNAVAILABLE` (`400`): categoria técnica `ADJUSTMENT` do usuário ausente ou arquivada.
- `TRANSACTION_ACCOUNT_UNAVAILABLE` (`409`): account inexistente, de outro usuário ou arquivada.
- `BALANCE_ADJUSTMENT_NO_DIFFERENCE` (`409`): o saldo atual da account já é igual a `targetBalanceCents`.

---

## Fluxo Alternativo — Ajuste Manual por Delta

Quando o usuário já conhece o valor exato da diferença e a direção, pode enviar `POST /transactions` com:

- `type = ADJUSTMENT`;
- `amountCents > 0`;
- `direction = INCREASE` ou `DECREASE` (campo exclusivo de `ADJUSTMENT`);
- `description` obrigatória não vazia;
- `date` (`YYYY-MM-DD`) e `status` (`EFFECTIVE` por padrão ou `PENDING`).

A categoria técnica `ADJUSTMENT` também é resolvida automaticamente pelo backend. Todas as invariantes definidas em [Adjustments are technical transactions](../decisions/adjustments-are-technical-transactions.md) continuam obrigatórias.
