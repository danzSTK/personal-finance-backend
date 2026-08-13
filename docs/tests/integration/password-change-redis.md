# `password-change-redis.integration-spec.ts`

## Objetivo e cobertura

Valida os scripts Lua e o state store reais: substituição/leitura da projeção,
aquisição concorrente da barreira, PTTL e liberação exclusiva pelo owner token.

## Dependências

Usa um container `redis:7-alpine`, ioredis e `RedisPasswordChangeStateStore` real.
Não usa PostgreSQL, NestJS ou rede externa. O banco Redis é limpo entre cenários;
cliente e container são fechados no teardown.

## Execução

```bash
npm run test:integration -- --runTestsByPath test/password-change-redis.integration-spec.ts
npm run test:integration
```

Atualizar ao mudar scripts Lua, chaves, payload, TTL, owner token ou cleanup.

