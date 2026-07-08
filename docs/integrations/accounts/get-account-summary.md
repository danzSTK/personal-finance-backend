---
area: accounts
type: integration
status: current
endpoint: GET /accounts/summary
---

# Get Account Summary

Retorna o saldo agregado das accounts do usuário autenticado.

```http
GET /accounts/summary
```

Por padrão, o saldo agregado considera somente accounts ativas com `includeInTotal=true`.

## Query params

| Campo | Tipo | Default | Observação |
|---|---|---|---|
| `projectedUntil` | `YYYY-MM-DD` | - | Quando enviado, retorna `projectedCents` até esta data |
| `includeArchived` | `boolean` | `false` | Quando `true`, inclui accounts arquivadas |
| `includeExcludedFromTotal` | `boolean` | `false` | Quando `true`, inclui accounts com `includeInTotal=false` |

## Exemplos

```http
GET /accounts/summary
GET /accounts/summary?projectedUntil=2026-06-30
GET /accounts/summary?includeArchived=true&includeExcludedFromTotal=true
```

## Resposta

Sem projeção:

```json
{
  "object": "account.summary",
  "currentCents": 250000
}
```

Com projeção:

```json
{
  "object": "account.summary",
  "currentCents": 250000,
  "projectedCents": 210000,
  "projectedUntil": "2026-06-30"
}
```

## Regras

`currentCents` representa o saldo atual real das accounts selecionadas.

`projectedCents` só aparece quando `projectedUntil` é enviado. Ele representa a leitura até a data informada, considerando pendências com `date <= projectedUntil`.

Os parâmetros `includeArchived` e `includeExcludedFromTotal` alteram apenas o conjunto de accounts somadas. A fórmula de saldo permanece a mesma.

## Respostas

| Status | Quando |
|---:|---|
| `200` | Summary retornado |
| `400` | Query inválida |
| `401` | Sessão ausente ou inválida |
