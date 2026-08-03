---
area: auth
type: decision
status: current
related:
  - ../lua-scripts.md
  - ./redis-cluster-hash-tags.md
---

# Scripts Lua para transições atômicas

## Decisão

Leitura com limpeza de janelas, aquisição da barreira e substituição da projeção
são executadas por scripts Lua no Redis.

## Motivos

- Um pipeline reduz round trips, mas permite interleaving de outro cliente.
- As seis chaves representam um único snapshot lógico.
- `initialized` não pode aparecer antes de todas as métricas estarem prontas.

## Consequências

- Cada transição multi-key é atômica.
- Os scripts precisam permanecer curtos, determinísticos e sem I/O externo.
- Todas as chaves utilizadas pelo mesmo script devem estar no mesmo slot.
