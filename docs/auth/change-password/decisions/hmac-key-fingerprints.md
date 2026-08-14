---
area: auth
type: decision
status: current
related:
  - ../redis-keys.md
  - ./technical-cost-limiter.md
---

# Fingerprints HMAC no keyspace técnico

## Decisão

IP e JTI não aparecem diretamente nas chaves do limitador. Seus fingerprints
usam HMAC-SHA256 com segredo de configuração.

## Motivos

- Reduzir correlação em inspeções, snapshots e logs de chaves.
- Impedir enumeração simples de IPs, que possuem baixa entropia, sem o segredo.
- Manter nomes de chave uniformes e seguros.

## Consequências

- HMAC não é criptografia reversível.
- Rotação do segredo cria um novo namespace de contadores até os TTLs antigos
  expirarem.
- O HMAC não é usado no campo de auditoria:
  `password_change_events.session_id` contém o JTI original do access token.
