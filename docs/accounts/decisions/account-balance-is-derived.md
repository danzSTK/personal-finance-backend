---
area: accounts
type: decision
status: current
related:
  - ../concepts/account-balance.md
---

# Account Balance É Derivado

## Decisão

Saldo de account não deve ser armazenado como coluna.

## Fórmula

O cálculo parte de `initialBalanceCents` e aplica os impactos de transactions efetivas e não deletadas.

Para a account consultada:

- `INCOME` soma;
- `EXPENSE` subtrai;
- `TRANSFER` subtrai na origem e soma no destino;
- `ADJUSTMENT` soma ou subtrai conforme `direction`.

## Motivos

- Preserva integridade histórica.
- Evita divergência entre saldo persistido e movimentações.
- Torna o histórico a fonte da verdade.

## Futuro

Snapshots podem ser adicionados como otimização se o volume exigir.
