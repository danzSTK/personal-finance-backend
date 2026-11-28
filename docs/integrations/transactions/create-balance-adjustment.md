---
area: transactions
type: integration
status: current
method: POST
path: /transactions/balance-adjustments
---

# Create Balance Adjustment

Calcula automaticamente a diferença entre o saldo desejado (`targetBalanceCents`) e o saldo atual derivado (`currentCents`) de uma account e cria a transaction técnica `ADJUSTMENT` correspondente com `status = EFFECTIVE`.

## Request

```http
POST /transactions/balance-adjustments
Content-Type: application/json
```

### Body

```json
{
  "accountId": "a6e1a79f-6fbd-441d-93b7-458de6cf1f35",
  "targetBalanceCents": 100000,
  "date": "2026-06-23",
  "description": "Conciliação com extrato bancário"
}
```

### Campos

| Campo                | Tipo           | Obrigatório | Descrição                                                                                         |
| -------------------- | -------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `accountId`          | `string (uuid)` | Sim        | ID de uma account ativa do usuário autenticado.                                                   |
| `targetBalanceCents` | `integer`      | Sim         | Saldo real/desejado da account em centavos. Aceita valores negativos, `0` ou positivos.           |
| `date`               | `DateOnly`     | Sim         | Data financeira no formato `YYYY-MM-DD` (enviada pelo frontend no fuso local do usuário).         |
| `description`        | `string \| null` | Não       | Motivo opcional (máx. 500 caracteres). Quando omitido, `null` ou vazio, usa `"Reajuste de saldo"`. |

## Regras De Cálculo

- O saldo de referência é o **saldo atual derivado** da account (`initialBalanceCents` + transactions `EFFECTIVE` não deletadas; transactions `PENDING` são ignoradas).
- Se `targetBalanceCents > currentCents`: cria `ADJUSTMENT` com `direction = INCREASE` e `amountCents = targetBalanceCents - currentCents`.
- Se `targetBalanceCents < currentCents`: cria `ADJUSTMENT` com `direction = DECREASE` e `amountCents = currentCents - targetBalanceCents`.
- Se `targetBalanceCents === currentCents`: retorna `409 Conflict` com `code = BALANCE_ADJUSTMENT_NO_DIFFERENCE` sem criar transação.
- A categoria técnica `ADJUSTMENT` é resolvida automaticamente pelo backend; não envie `categoryId`, `type`, `status` nem `direction`.

## Response

`201 Created`

Retorna o mesmo modelo de transaction (`TransactionResponseDto`) de `POST /transactions`:

```json
{
  "id": "2f9f2b7d-881e-41bd-9cde-27f7e10f30f0",
  "accountId": "a6e1a79f-6fbd-441d-93b7-458de6cf1f35",
  "destinationAccountId": null,
  "categoryId": "8f2b1c9e-1d4e-4b7b-9b7a-3a9f77e12345",
  "type": "ADJUSTMENT",
  "status": "EFFECTIVE",
  "amountCents": 2000,
  "date": "2026-06-23",
  "effectiveAt": "2026-06-23T12:00:00.000Z",
  "description": "Conciliação com extrato bancário",
  "direction": "INCREASE",
  "attachmentsCount": 0,
  "hasFiscalNote": false,
  "createdAt": "2026-06-23T12:00:00.000Z",
  "updatedAt": "2026-06-23T12:00:00.000Z"
}
```

## Erros Esperados

- `VALIDATION_ERROR` (`400`)
- `INVALID_TRANSACTION` (`400`)
- `TRANSACTION_CATEGORY_UNAVAILABLE` (`400`)
- `TRANSACTION_ACCOUNT_UNAVAILABLE` (`409`)
- `BALANCE_ADJUSTMENT_NO_DIFFERENCE` (`409`)
