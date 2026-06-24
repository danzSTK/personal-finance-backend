---
area: transactions
type: flow
status: current
endpoint: PATCH /transactions/:id
related:
  - ../concepts/transaction.md
  - ../reference/invariants.md
---

# Update Transaction

Atualiza uma transaction existente do usuário autenticado.

## Entrada

PATCH aceita campos parciais:

- `accountId`;
- `destinationAccountId`;
- `categoryId`, quando o próximo type for `INCOME` ou `EXPENSE`;
- `type`;
- `amountCents`;
- `date`;
- `description`;
- `direction`.

Status não é alterado por esta rota.

## Fluxo

1. Controller valida e converte entrada.
2. Use case busca a transaction não deletada do usuário.
3. Use case rejeita patch vazio.
4. Use case calcula o próximo estado lógico da transaction.
5. Use case valida account/category conforme o próximo estado, resolvendo category técnica para `TRANSFER`/`ADJUSTMENT`.
6. Entidade aplica o patch e protege invariantes.
7. Repository salva e retorna a transaction atualizada.

## Regras

- Se o próximo `type` não for `TRANSFER`, `destinationAccountId` é removido.
- Se o próximo `type` não for `ADJUSTMENT`, `direction` é removido.
- Ao mudar para `TRANSFER`, a request precisa manter ou informar destino válido.
- Ao mudar para `ADJUSTMENT`, a request precisa manter ou informar `direction` e `description`.
- Ao mudar para `TRANSFER` ou `ADJUSTMENT`, o backend troca a category para a técnica correspondente.

## Erros

Principais codes:

- `TRANSACTION_NOT_FOUND`;
- `TRANSACTION_UPDATE_EMPTY`;
- `INVALID_TRANSACTION`;
- `TRANSACTION_ACCOUNT_UNAVAILABLE`;
- `TRANSACTION_CATEGORY_UNAVAILABLE`;
- `TRANSACTION_CATEGORY_INCOMPATIBLE`.
