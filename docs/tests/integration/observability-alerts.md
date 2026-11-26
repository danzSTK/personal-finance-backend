# `observability-alerts.integration-spec.ts`

## Classificação e objetivo

- Arquivo: `api/test/observability-alerts.integration-spec.ts`
- Categoria: integração.
- Objetivo: validar o cooldown distribuído no Redis real (`SET NX EX`), supressão de alertas duplicados, remoção do cooldown em `RESOLVED` e fallback em memória quando o Redis falha em `OperationalAlertService`.
- Fora de escopo: chamadas HTTP reais à Telegram Bot API, PostgreSQL, BullMQ e inicialização completa do container NestJS.

## Comportamentos comprovados

- `CRITICAL` adquire chave de cooldown `obs:alert:cooldown:<alertKey>` via `SET ... EX 900 NX` com TTL positivo no Redis real e suprime notificações duplicadas dentro da janela;
- `RESOLVED` remove a chave de cooldown no Redis (`exists === 0`) e entrega a notificação de recuperação imediatamente, permitindo que uma ocorrência `CRITICAL` posterior volte a ser notificada;
- falha de conexão/comando no Redis durante a checagem de cooldown não lança exceção ao chamador, registra log `warn` com `event: 'OPERATIONAL_ALERT_COOLDOWN_REDIS_ERROR'` e aplica fallback de deduplicação em memória para evitar flood.

## Composição

- Componentes reais: `redis:7-alpine`, `ioredis`, `RedisService`, `CacheKeys.observability.alertCooldown` e `OperationalAlertService`.
- Componentes mockados: `IOperationalAlertNotifier` (`notifier.send`), objeto simulado de `RedisService` que rejeita comandos no cenário de fallback e `jest.spyOn(Logger.prototype, 'warn')`.

## Dependências de execução

| Dependência | Versão                           | Provisionamento               | Obrigatória |
| ----------- | -------------------------------- | ----------------------------- | ----------- |
| Redis       | `7-alpine`                       | Testcontainers, porta efêmera | sim         |
| Docker      | versão disponível no host/runner | daemon local ou CI            | sim         |

- Docker: obrigatório via `@testcontainers/redis`.
- Rede externa: nenhuma além do download inicial da imagem.
- Credenciais reais: nenhuma (usa senha sintética no container Redis e notifier mockado).
- Portas: porta efêmera atribuída pelo Testcontainers.

## Isolamento e cleanup

Usa dados sintéticos e executa `client.flushdb()` em `beforeEach`. Encerra o cliente `ioredis` (`quit()` ou `disconnect()`) e para o container Redis em `afterAll`.

## Execução

```bash
# Diagnóstico direcionado
npm run test:integration -- --runTestsByPath test/observability-alerts.integration-spec.ts

# Validação agregada obrigatória
npm run test:integration
```

- Job de CI: `Integration tests`.
- Falhas de ambiente conhecidas: Docker indisponível ou download da imagem `redis:7-alpine` bloqueado.

## Quando atualizar

Atualizar esta página quando mudarem o formato de `CacheKeys.observability.alertCooldown`, a semântica de cooldown/TTL (`SET NX EX`), o fluxo `RESOLVED`, o fallback em memória ou o provisionamento do Redis.
