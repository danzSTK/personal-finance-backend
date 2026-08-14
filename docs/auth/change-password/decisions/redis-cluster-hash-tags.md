---
area: auth
type: decision
status: current
related:
  - ../redis-keys.md
  - ./atomic-lua-scripts.md
---

# Hash tags para compatibilidade com Redis Cluster

## Decisão

Todas as chaves da projeção por usuário incluem `{userId}` como hash tag.

## Motivos

- Scripts Lua multi-key exigem que todas as chaves estejam no mesmo slot em
  Redis Cluster.
- A compatibilidade pode ser preservada antes de uma eventual migração para
  cluster.

## Consequências

- As seis chaves operacionais de um usuário compartilham o mesmo slot.
- Chaves técnicas por IP e JTI não participam desses scripts e não precisam da
  mesma hash tag.
- O formato das chaves passa a fazer parte do contrato de infraestrutura.
