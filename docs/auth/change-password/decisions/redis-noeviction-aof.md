---
area: auth
type: decision
status: current
related:
  - ../redis-keys.md
  - ./postgres-authority-redis-projection.md
---

# Redis com AOF e `noeviction`

## Decisão

Usar persistência AOF e `maxmemory-policy noeviction` no Redis que mantém o
estado operacional.

## Motivos

- Eviction silenciosa pode remover partes de um estado de segurança.
- Falha explícita é preferível a remoção imprevisível de chaves.
- AOF reduz perda após reinicialização, embora o PostgreSQL ainda permita
  reconstrução.

## Consequências

- Memória e rejeições de escrita precisam de observabilidade.
- Ao atingir o limite, writes podem falhar e a alteração de senha pode responder
  `503`.
- Capacidade do Redis deve considerar sessões, projeções e demais caches da
  aplicação.
