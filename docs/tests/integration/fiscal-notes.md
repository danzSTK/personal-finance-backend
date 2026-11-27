# `fiscal-notes.integration-spec.ts`

## Classificação e objetivo

- Arquivo: `api/test/fiscal-notes.integration-spec.ts`
- Categoria: integração.
- Objetivo: validar a persistência e consulta real de `fiscal_notes`, `fiscal_note_items` e `fiscal_note_payments` no PostgreSQL (incluindo migration `up/down/up`, índices parciais únicos e índice composto `idx_fiscal_notes_user_issued_at_active`, listagem paginada com filtros/ordenação/`EXISTS`/`summary`, busca direta por `(id, userId)`, concorrência `23505`, multi-tenancy e soft delete sincronizado com `transactions`), o comportamento real no Redis (cache hit com Circuit Breaker aberto, rate limiter Lua por usuário e global por UF, abertura/cooldown progressivo/recuperação do `CircuitBreakerService`) e o fluxo HTTP completo do `SefazCeProvider` contra servidor HTTP stub local efêmero.
- Fora de escopo: chamadas reais à SEFAZ-CE na internet, envio real ao Telegram Bot API e processo Worker/BullMQ.

## Comportamentos comprovados

- migration `CreateFiscalNotesTables1789000000000` executa `up`, `down` e `up` em PostgreSQL 16 real preservando constraints `CHK_*`, FKs, trigger `trg_fiscal_notes_updated_at` e o índice parcial composto `idx_fiscal_notes_user_issued_at_active` verificado em `pg_indexes`;
- `FiscalNoteRepository.list` em PostgreSQL real valida paginação e ordenação determinística (com desempate por `id`), limites de data civil em `-03:00` (`issuedFrom`/`issuedTo`), filtros combináveis (`issuerCnpj`, `sourceUf`, `minAmountCents`, `maxAmountCents`), busca `search` via `EXISTS` com escape de `%`, `_` e `\` sem duplicação de linhas nem dupla contagem no `summary`, contagem `itemsCount`, totais agregados em `summary`, exclusão de registros soft-deletados e isolamento multi-tenant;
- `FiscalNoteRepository.findActiveByIdAndUserId` em PostgreSQL real retorna a nota ativa com `items` e `payments` ordenados, excluindo registros soft-deletados e isolando notas de outros usuários;
- índices parciais `UQ_fiscal_notes_user_access_key_active` e `UQ_fiscal_notes_transaction_active` bloqueiam duplicidade ativa e permitem reimportação após soft delete e importação da mesma chave por usuários distintos;
- concorrência real com violação `23505` é convertida em `409 FISCAL_NOTE_ALREADY_IMPORTED` ou `409 TRANSACTION_ALREADY_HAS_FISCAL_NOTE` com `details`;
- `DeleteTransactionUseCase` realiza soft delete sincronizado da `FiscalNote` na mesma transação PostgreSQL e `UpdateTransactionUseCase` bloqueia mudança de `type` com nota ativa;
- `ListTransactionsUseCase` popula `hasFiscalNote` em lote sem N+1;
- `RedisFiscalNoteCache` entrega `cacheHit: true` no Redis real mesmo com `CircuitBreakerService` em estado `OPEN`;
- `RedisFiscalNoteRateLimiter` aplica scripts Lua reais no Redis (`user 1m/1h` antes de `global UF 1m`);
- `CircuitBreakerService` abre após `failureThreshold`, aplica cooldown progressivo (`60s -> 120s -> 300s`), permite sonda única em `HALF_OPEN` e fecha em sucesso;
- `SefazCeHttpClient` + `SefazCeHtmlParser` consultam servidor HTTP stub local em porta efêmera validando timeout, limite de 1 MB, 1 retry transitório e descarte do bloco `Consumidor`.

## Composição

- Componentes reais: `postgres:16-alpine`, `redis:7-alpine`, migrations TypeORM, `FiscalNotesModule`, `TransactionsModule`, `CircuitBreakerModule`, `RedisFiscalNoteCache`, `RedisFiscalNoteRateLimiter`, `SefazCeProvider` e servidor HTTP stub local em `127.0.0.1` com porta efêmera (`0`).
- Componentes mockados: notificações Telegram (`NODE_ENV=test` força `NoopOperationalAlertNotifier`) e respostas da SEFAZ servidas pelo servidor HTTP stub local (sem rede externa).

## Dependências de execução

| Dependência | Versão | Provisionamento | Obrigatória |
| ----------- | ------ | --------------- | ----------- |
| PostgreSQL | `16-alpine` | Testcontainers, porta efêmera | sim |
| Redis | `7-alpine` | Testcontainers, porta efêmera | sim |
| Stub HTTP SEFAZ-CE | — | `node:http` local em `127.0.0.1:0` (porta efêmera) | sim |
| Docker | versão disponível no host/runner | daemon local ou CI | sim |

- Docker: obrigatório via `@testcontainers/postgresql` e `@testcontainers/redis`.
- Rede externa: nenhuma além do download inicial das imagens Docker (proibido acessar a SEFAZ real).
- Credenciais reais: nenhuma (usa credenciais sintéticas geradas para os containers).
- Portas: portas efêmeras atribuídas pelo Testcontainers e pelo servidor stub local.

## Isolamento e cleanup

Usa dados sintéticos, limpa estado do Redis (`flushdb()`) e tabelas PostgreSQL entre cenários, e fecha servidor HTTP stub local, conexões Redis/TypeORM, contexto NestJS e ambos os containers em `afterAll` mesmo em caso de falha.

## Execução

```bash
# Diagnóstico direcionado
npm run test:integration -- --runTestsByPath test/fiscal-notes.integration-spec.ts

# Validação agregada obrigatória
npm run test:integration
```

- Job de CI: `Integration tests`.
- Falhas de ambiente conhecidas: Docker indisponível ou bloqueio no pull das imagens `postgres:16-alpine` / `redis:7-alpine`.

## Quando atualizar

Atualizar esta página quando mudarem a migration `CreateFiscalNotesTables1789000000000`, índices parciais, chaves Redis, comportamento do `CircuitBreakerService`, cenários do stub HTTP local ou provisionamento de containers.
