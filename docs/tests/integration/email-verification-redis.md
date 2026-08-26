# `email-verification-redis.integration-spec.ts`

## Classificação e objetivo

- Arquivo: `api/test/email-verification-redis.integration-spec.ts`
- Categoria: integração.
- Objetivo: validar os cinco scripts Lua e o store Redis real do reenvio.
- Fora de escopo: PostgreSQL, NestJS, BullMQ e provider de e-mail.

## Comportamentos comprovados

- chaves ausentes representam estado disponível e vazio;
- somente uma reserva concorrente adquire a barreira;
- somente o dono renova a barreira e a renovação restaura o TTL integral;
- automático cria cooldown sem consumir o limite manual;
- challenge manual repetido é idempotente e cinco challenges bloqueiam o sexto;
- somente o mutation token proprietário remove `pending`.

## Composição

- Componentes reais: `redis:7-alpine`, ioredis, scripts Lua e
  `RedisEmailVerificationResendStateStore`.
- Componentes mockados: nenhum.

## Dependências de execução

| Dependência | Versão                           | Provisionamento               | Obrigatória |
| ----------- | -------------------------------- | ----------------------------- | ----------- |
| Redis       | `7-alpine`                       | Testcontainers, porta efêmera | sim         |
| Docker      | versão disponível no host/runner | daemon local ou CI            | sim         |

Não usa rede externa além do download inicial da imagem, credenciais reais ou
portas fixas. A dependência já existia na suíte e no job de integração; nenhuma
mudança de pipeline foi necessária.

## Isolamento e cleanup

Cada cenário usa UUIDs sintéticos e `FLUSHDB`. Cliente e container são fechados
em `afterAll`, inclusive sem compartilhar estado com outras suítes.

## Execução

```bash
npm run test:integration -- --runTestsByPath test/email-verification-redis.integration-spec.ts
npm run test:integration
```

- Job de CI: `Integration tests`.
- Falhas de ambiente: Docker indisponível ou download da imagem bloqueado.

## Quando atualizar

Atualizar quando mudarem scripts, chaves, constantes, PTTL, contratos de retorno,
idempotência, aquisição/renovação/ownership da barreira ou provisionamento.
