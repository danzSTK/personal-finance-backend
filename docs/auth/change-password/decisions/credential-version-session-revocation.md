---
area: auth
type: decision
status: current
related:
  - ../flow/success.md
  - ./separated-outbox-events.md
---

# `credentialVersion` e revogação de sessões

## Decisão

Incrementar `users.credential_version` na mesma transação que troca o hash.
Depois do commit, remover sessões Redis diretamente e também publicar
`auth.sessions.revoke-all-requested`.

## Motivos

- Não existe enumeração completa de todos os access tokens emitidos.
- A versão invalida access e refresh tokens sem depender da limpeza do Redis.
- A remoção física ainda é útil para higiene e listagem de sessões.

## Consequências

- Revogação lógica é imediata e durável.
- Tokens sem claim são tratados como versão `1` para compatibilidade.
- Falha na limpeza física não revalida tokens e pode ser repetida pelo worker.
