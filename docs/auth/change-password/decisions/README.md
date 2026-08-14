---
area: auth
type: index
status: current
related:
  - ../index.md
  - ../flow/README.md
  - ../../../specs/auth/change-password/specs/decisions.md
---

# Decisões da alteração de senha

Cada arquivo registra uma decisão arquitetural com seus motivos e
consequências. Valores exatos das regras permanecem nos requisitos e nas
constantes do domínio.

## Dados e projeção

- [PostgreSQL como autoridade e Redis como projeção](./postgres-authority-redis-projection.md)
- [Substituição integral da projeção](./full-projection-replacement.md)
- [Scripts Lua para transições atômicas](./atomic-lua-scripts.md)
- [`initialized` como marcador de completude](./initialized-completeness-marker.md)
- [Fatos antes da projeção](./persist-facts-before-projection.md)
- [Hash tags para Redis Cluster](./redis-cluster-hash-tags.md)
- [Redis com AOF e `noeviction`](./redis-noeviction-aof.md)

## Concorrência e regras

- [Barreira Redis e lock SQL](./redis-barrier-and-sql-lock.md)
- [Confirmar eventos de senha incorreta](./commit-invalid-password-events.md)
- [Quinta falha inicia o bloqueio](./fifth-failure-starts-block.md)
- [Fatos persistidos e restrições derivadas](./facts-versus-derived-restrictions.md)
- [Policy pura e maior retry](./pure-policy-longest-retry.md)
- [Limitador técnico separado da policy](./technical-cost-limiter.md)

## Resiliência, sessões e eventos

- [Reconciliação imediata e durável](./immediate-and-durable-reconciliation.md)
- [`credentialVersion` e revogação de sessões](./credential-version-session-revocation.md)
- [Eventos de outbox separados por responsabilidade](./separated-outbox-events.md)
- [Intenções lógicas e idempotentes de e-mail](./logical-versioned-email-intents.md)

## Segurança operacional

- [Fingerprints HMAC no keyspace técnico](./hmac-key-fingerprints.md)
- [IP derivado da cadeia de proxies confiáveis](./trusted-client-ip.md)
- [Contexto de segurança sanitizado](./sanitized-security-context.md)
