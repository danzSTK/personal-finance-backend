---
area: accounts
type: concept
status: current
related:
  - ../flows/set-default-account.md
  - ../flows/archive-account.md
---

# Default Account

A default account é a conta padrão do usuário.

## Regras Atuais

- Uma account arquivada não pode virar default.
- Uma account default não pode ser arquivada.
- Para arquivar uma account default, outra account precisa virar default antes.

## Intenção

A default account é o destino para transações não registradas/classificadas quando o sistema precisar de uma conta de fallback.
