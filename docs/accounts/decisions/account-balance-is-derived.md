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

```text
initialBalance + receitas - despesas
```

## Motivos

- Preserva integridade histórica.
- Evita divergência entre saldo persistido e movimentações.
- Torna o histórico a fonte da verdade.

## Futuro

Snapshots podem ser adicionados como otimização se o volume exigir.
