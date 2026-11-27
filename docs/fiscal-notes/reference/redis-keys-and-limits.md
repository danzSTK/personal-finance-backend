---
area: fiscal-notes
type: reference
status: current
related:
  - ../flows/preview-and-resilience.md
  - ../decisions/reusable-redis-circuit-breaker.md
  - ../../configuration.md
---

# Redis Keys and Limits

Todas as chaves Redis utilizadas pelo módulo `fiscal-notes` são centralizadas em `CacheKeys.fiscalNotes` (`api/src/common/utils/cache-keys.factory.ts`), enquanto o sufixo de lock de sonda do Circuit Breaker reside em `api/src/shared/circuit-breaker/constants/circuit-breaker.constants.ts`.

## Chaves Redis

| Chave / Padrão | Fábrica / Origem | Tipo | TTL Padrão | Finalidade |
| --- | --- | --- | --- | --- |
| `fiscal-notes:parsed:v1:{accessKey}` | `CacheKeys.fiscalNotes.parsed(accessKey)` | `string` (JSON) | `1200s` (`FISCAL_NOTES_CACHE_TTL_SECONDS`) | Cache dos dados sanitizados (`ParsedFiscalNoteData` sem `Consumidor` e sem HTML bruto) |
| `fiscal-notes:rl:sefaz:user:{userId}:1m` | `CacheKeys.fiscalNotes.rateLimitUser1m(userId)` | `string` (contador) | `60s` | Rate limit por usuário em cache miss (janela de 1 minuto) |
| `fiscal-notes:rl:sefaz:user:{userId}:1h` | `CacheKeys.fiscalNotes.rateLimitUser1h(userId)` | `string` (contador) | `3600s` | Rate limit por usuário em cache miss (janela de 1 hora) |
| `fiscal-notes:rl:sefaz:global:{uf}:1m` | `CacheKeys.fiscalNotes.rateLimitGlobal1m(uf)` | `string` (contador) | `60s` | Rate limit global da VPS por UF em cache miss (janela de 1 minuto) |
| `fiscal-notes:cb:v1:{uf}` | `CacheKeys.fiscalNotes.circuitBreaker(uf)` | `string` (JSON) | `86400s` (24h) | Estado distribuído do Circuit Breaker (`CLOSED \| OPEN \| HALF_OPEN`, falhas consecutivas, `cooldownStage`, timestamps) |
| `fiscal-notes:cb:v1:{uf}:probe` | `CircuitBreakerService` (`:probe`) | `string` (`'1'`) | `20s` (default dinâmico; fallback `15s`) | Lock curto (`SET ... NX EX <probeLockTtlSeconds>`) garantindo uma única requisição de sonda na transição `OPEN -> HALF_OPEN`; `FiscalNoteQueryService` dimensiona `probeLockTtlSeconds` pela janela máxima de timeout + retry (`ceil((timeoutMs * (maxRetries + 1) + retryBackoffMs * maxRetries) / 1000) + 5s`, até `38s` no teto Joi) |

## Camadas de Rate Limit e Limites HTTP

1. **Camada 1 — Throttle HTTP por Rota (`@Throttle`):** `10` requisições a cada `60_000 ms` (`FISCAL_NOTES_HTTP_THROTTLE_LIMIT` / `FISCAL_NOTES_HTTP_THROTTLE_TTL_MS`) aplicadas em `POST /fiscal-notes/preview`, `POST /fiscal-notes/import` e `POST /transactions/:id/fiscal-note`, inclusive em cache hit.
2. **Camada 2A — Quota de Usuário em Cache Miss (Redis Lua):** `5` consultas por minuto e `30` consultas por hora. Checada **antes** da quota global para impedir que um usuário abusivo consuma a cota compartilhada da VPS.
3. **Camada 2B — Quota Global da VPS por UF em Cache Miss (Redis Lua):** `40` consultas por minuto (`uf = '23'`). Ao atingir o teto, retorna `503 SEFAZ_TEMPORARILY_UNAVAILABLE` e dispara alerta `WARN` (`FISCAL_NOTE_SEFAZ_GLOBAL_RL_HIT`).

## Parâmetros Configuráveis (`FISCAL_NOTES_*`)

| Variável | Default | Faixa Joi | Uso |
| --- | --- | --- | --- |
| `FISCAL_NOTES_SEFAZ_CE_BASE_URL` | `http://nfce.sefaz.ce.gov.br` | URI `http`/`https` | Base URL allowlisted do provedor SEFAZ-CE |
| `FISCAL_NOTES_HTTP_TIMEOUT_MS` | `7000` | `1000..15000` | Timeout por tentativa HTTP à SEFAZ-CE |
| `FISCAL_NOTES_HTTP_RETRY_BACKOFF_MS` | `400` | `50..3000` | Espera antes do único retry transitório |
| `FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES` | `1048576` | `65536..1048576` | Limite rígido (teto de 1 MB) no corpo da resposta HTTP |
| `FISCAL_NOTES_CACHE_TTL_SECONDS` | `1200` | `60..3600` | TTL do cache Redis da nota parseada |
| `FISCAL_NOTES_RL_USER_PER_MINUTE` | `5` | `1..100` | Limite de cache miss por usuário em 1 minuto |
| `FISCAL_NOTES_RL_USER_PER_HOUR` | `30` | `1..1000` | Limite de cache miss por usuário em 1 hora |
| `FISCAL_NOTES_RL_GLOBAL_PER_MINUTE` | `40` | `1..1000` | Limite global da VPS por UF em 1 minuto |
| `FISCAL_NOTES_CB_FAILURE_THRESHOLD` | `5` | `1..50` | Falhas consecutivas de infra/parser para abrir o Circuit Breaker |
| `FISCAL_NOTES_CB_COOLDOWN_SECONDS` | `60,120,300` | CSV de inteiros `>= 5` | Degraus progressivos de cooldown em segundos |
