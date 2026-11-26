---
area: fiscal-notes
type: decision
status: current
related:
  - ../flows/preview-and-resilience.md
  - ../reference/redis-keys-and-limits.md
  - ../../platform/observability/README.md
---

# Circuit Breaker Distribuído no Redis em `shared/circuit-breaker` e Isolado de `/health`

## Decisão

Implementar o Circuit Breaker como componente transversal reutilizável em `api/src/shared/circuit-breaker/` (`CircuitBreakerModule` e `CircuitBreakerService`), com:

- estado persistido em JSON no Redis (`CLOSED`, `OPEN`, `HALF_OPEN`) e lock curto de sonda única (`:probe` via `SET NX EX 15`) durante `HALF_OPEN`;
- limiar configurável de falhas consecutivas (padrão `5`) e cooldown progressivo em degraus (padrão `60s -> 120s -> 300s`);
- degradação segura **fail-open** caso o Redis falhe ou esteja indisponível (log `warn` `CIRCUIT_BREAKER_REDIS_ERROR`, sem derrubar requisições);
- **isolamento total de `/health/liveness` e `/health/readiness`**: o estado do Circuit Breaker e a disponibilidade da SEFAZ nunca interferem nos health checks da API.

## Motivos

1. **Estado Compartilhado Entre Réplicas e Reinícios:**
   - *Alternativa descartada — Circuit Breaker em memória do processo:* múltiplas réplicas da API ou reinícios de container perderiam o histórico de falhas e continuariam bombardeando uma SEFAZ degradada. Persistir o estado no Redis (`fiscal-notes:cb:v1:{uf}`) sincroniza a proteção entre instâncias.
2. **Reuso Transversal na Plataforma:**
   - *Alternativa descartada — Acoplar a máquina de estados dentro de `SefazCeProvider`:* futuras integrações externas (novas UFs, provedores financeiros ou APIs externas) demandam o mesmo padrão de proteção. Isolar em `api/src/shared/circuit-breaker/` permite reuso sem dependências de domínio de `fiscal-notes`.
3. **Proteção Contra Falsos Positivos em `/health`:**
   - *Alternativa descartada — Expor status da SEFAZ no `/health/readiness`:* indisponibilidades temporárias do portal estadual da SEFAZ não significam que a API da Danfy está inoperante. Acoplar terceiros não críticos ao readiness faria orquestradores/proxies retirarem a API inteira de rotação e impediria consultas em cache hit.
4. **Classificação Seletiva de Falhas:** Erros de negócio retornados pela SEFAZ (`{ "erro": ... }`, nota inexistente, cancelada ou homologação) indicam que o serviço estadual respondeu normalmente e **não** incrementam falhas do Circuit Breaker; apenas falhas de infraestrutura (timeout, rede, HTTP `5xx`, resposta `> 1 MB`) e quebras estruturais de parser abrem o circuito.

## Trade-offs e Riscos Aceitos

- **Operação Read-Modify-Write no Redis:** A atualização do JSON de estado não usa lock distribuído global nas transições `CLOSED -> OPEN`, aceitando eventual perda mínima de precisão na contagem exata sob altíssima concorrência em troca de simplicidade operacional; a transição `OPEN -> HALF_OPEN`, por outro lado, é protegida por lock atômico `SET NX EX` (`:probe`) para evitar tempestade de sondas simultâneas na recuperação.
- **Dependência Suave do Redis:** Em falha do Redis, o componente assume `fail-open` (`allowed: true`) para não indisponibilizar importações legítimas por falha de cache/estado auxiliar, compensado pelo timeout curto (`7000ms`) e limite de 1 retry no cliente HTTP.
