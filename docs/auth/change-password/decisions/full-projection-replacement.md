---
area: auth
type: decision
status: current
related:
  - ../redis-keys.md
  - ../lua-scripts.md
  - ./postgres-authority-redis-projection.md
---

# Substituição integral da projeção Redis

## Decisão

Depois de um fato durável, o sistema consulta novamente os eventos relevantes,
monta todas as métricas e executa `replace`. Não incrementa somente a chave
aparentemente afetada.

## Motivos

- Atualizações incrementais podem deixar falhas, bloqueio, reincidência e
  alterações em versões diferentes.
- Crash, retry, expiração parcial e reprocessamento exigiriam compensações por
  métrica.
- Hidratação por cache miss, `finally` e worker podem compartilhar o mesmo
  algoritmo de reconstrução.

## Consequências

- Cada sincronização usa mais leitura no PostgreSQL e mais escrita no Redis.
- A projeção é determinística para os mesmos fatos e horário.
- Retry é simples e não acumula incrementos duplicados.
- Perda total ou parcial do Redis é recuperada pelo mesmo caminho.
