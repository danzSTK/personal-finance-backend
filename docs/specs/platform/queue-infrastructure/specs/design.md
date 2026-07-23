---
area: platform
feature: queue-infrastructure
type: spec-design
status: current
related:
  - ./requirements.md
  - ./decisions.md
---

# Design - Queue Infrastructure

## Arquitetura

Criar uma infraestrutura compartilhada para BullMQ em:

```text
api/src/shared/jobs/
├── constants/
│   └── queue.constants.ts
├── jobs.module.ts
└── README.md
```

Criar configuração centralizada em:

```text
api/src/config/queue.config.ts
```

Registrar o módulo compartilhado em:

```text
api/src/app/app.module.ts
```

O módulo base deve configurar BullMQ globalmente, mas não deve registrar filas concretas. Filas futuras devem ser registradas pelos módulos consumidores com `BullModule.registerQueue(...)` ou por submódulos específicos.

## Dependências

Adicionar dependências runtime em `api/package.json`:

```text
@nestjs/bullmq
bullmq
```

`ioredis` já existe no projeto e continua sendo usado pelo RedisModule atual. BullMQ pode usar as opções de conexão esperadas pela própria lib, sem reutilizar diretamente o singleton `RedisService`.

## Configuração

Criar `queue.config.ts` com namespace `queue`.

Campos propostos:

```ts
{
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  prefix: string;
  defaultJobOptions: {
    attempts: number;
    backoffType: 'fixed' | 'exponential';
    backoffDelayMs: number;
    removeOnComplete: number;
    removeOnFail: number;
  };
  workers: {
    enabled: boolean;
    defaultConcurrency: number;
  };
}
```

## Variáveis De Ambiente

Adicionar ao schema Joi de `api/src/config/config.module.ts`:

```text
BULLMQ_REDIS_HOST
BULLMQ_REDIS_PORT
BULLMQ_REDIS_PASSWORD
BULLMQ_REDIS_DB
BULLMQ_PREFIX
BULLMQ_DEFAULT_ATTEMPTS
BULLMQ_BACKOFF_TYPE
BULLMQ_BACKOFF_DELAY_MS
BULLMQ_REMOVE_ON_COMPLETE
BULLMQ_REMOVE_ON_FAIL
BULLMQ_WORKERS_ENABLED
BULLMQ_DEFAULT_CONCURRENCY
```

Exemplo recomendado para desenvolvimento local com Redis dedicado:

```text
BULLMQ_REDIS_HOST=localhost
BULLMQ_REDIS_PORT=6381
BULLMQ_REDIS_PASSWORD=
BULLMQ_REDIS_DB=0
BULLMQ_PREFIX=personal-finance
BULLMQ_DEFAULT_ATTEMPTS=5
BULLMQ_BACKOFF_TYPE=exponential
BULLMQ_BACKOFF_DELAY_MS=5000
BULLMQ_REMOVE_ON_COMPLETE=1000
BULLMQ_REMOVE_ON_FAIL=5000
BULLMQ_WORKERS_ENABLED=true
BULLMQ_DEFAULT_CONCURRENCY=5
```

Como Joi não expande `${...}` automaticamente, a implementação deve ler `BULLMQ_*` quando existir e fazer fallback para `REDIS_*` dentro de `queue.config.ts`. Esse fallback existe para compatibilidade e ambientes temporários; o caminho recomendado para filas confiáveis é Redis dedicado.

Validações mínimas:

- portas e database devem ser números válidos;
- attempts deve ser maior ou igual a 1;
- backoff type deve aceitar apenas `fixed` ou `exponential`;
- delays, retenção e concurrency devem ser números positivos;
- password deve aceitar string vazia somente quando o ambiente permitir Redis sem autenticação.

## Módulo Compartilhado

Criar `JobsModule` como módulo de plataforma:

```text
api/src/shared/jobs/jobs.module.ts
```

Responsabilidades:

- importar `BullModule.forRootAsync`;
- injetar `queueConfig.KEY`;
- configurar conexão Redis;
- aplicar `prefix` como opção do BullMQ, não como `keyPrefix` do Redis;
- aplicar `defaultJobOptions`;
- exportar `BullModule` para módulos futuros registrarem filas.

O `JobsModule` pode ser global apenas se houver vantagem clara no wiring. A preferência inicial é importar `JobsModule` no `AppModule` e exportar `BullModule` para uso explícito em módulos que precisem registrar filas.

## Constantes E Convenções

Criar `queue.constants.ts` com valores de plataforma, sem filas de domínio:

```ts
export const QueueDefaults = {
  prefix: 'personal-finance',
} as const;
```

Não criar nomes como `email`, `notifications`, `welcome-email` ou equivalentes nesta spec.

Quando uma feature futura criar fila, ela deve definir:

- nome da fila;
- nomes dos jobs;
- payload versionado;
- contrato de idempotência;
- política de retry específica, se diferente do default;
- concurrency específica, se diferente do default.

## Workers Habilitados Ou Desabilitados

`BULLMQ_WORKERS_ENABLED` deve ficar disponível para workers futuros.

Esta spec não cria processors, então o flag não altera comportamento imediato. A documentação deve instruir processors futuros a respeitarem o flag quando houver processo separado para producers e workers.

Em uma etapa futura, se a aplicação separar processos, o mesmo código poderá subir em modo:

- `api`: aceita HTTP e enfileira jobs;
- `worker`: consome jobs;
- `api+worker`: modo local simples.

## Retry, Backoff E Retenção

Defaults de jobs:

- `attempts`: 5;
- `backoff.type`: `exponential`;
- `backoff.delay`: 5000 ms;
- `removeOnComplete`: manter últimos 1000;
- `removeOnFail`: manter últimos 5000.

Filas futuras podem sobrescrever esses valores quando houver requisito próprio.

Erros em workers futuros devem ser lançados como exceções para que BullMQ consiga marcar falha e acionar retry. Workers não devem engolir erro de execução quando o job precisa ser retentado.

## Redis

### Docker Compose Local

O Docker Compose local deve ter Redis dedicado para BullMQ:

```text
service: bullmq-redis
container: personal-finance-bullmq-redis
local port: 6381
internal port: 6379
volume: bullmqredisdata
maxmemory-policy: noeviction
appendonly: yes
```

Para a API local fora do Docker:

```text
BULLMQ_REDIS_HOST=localhost
BULLMQ_REDIS_PORT=6381
BULLMQ_REDIS_DB=0
```

Para a API containerizada, `docker-compose.yml` sobrescreve:

```text
BULLMQ_REDIS_HOST=bullmq-redis
BULLMQ_REDIS_PORT=6379
```

### Opção Recomendada

Usar Redis dedicado para BullMQ, com:

```text
maxmemory-policy noeviction
appendonly yes
```

Essa opção evita que chaves de jobs sejam removidas por política de cache.

### Opção Inicial Aceitável

Usar o Redis existente com database separado, por exemplo `BULLMQ_REDIS_DB=1`, apenas enquanto o ambiente for local ou de baixo risco.

Se usar o Redis existente, o `docker-compose.yml` deve ser revisado porque atualmente o Redis de cache pode usar política de eviction voltada para cache. Para filas confiáveis, a política precisa ser `noeviction` ou o BullMQ deve apontar para outro Redis.

## Relação Com Eventos E Outbox

Esta spec não altera `AppEventsModule` nem `OutboxModule`.

Regra para features futuras:

- Outbox continua sendo usado para persistir eventos de domínio junto da transação.
- Handlers de eventos podem chamar producers de fila quando o trabalho assíncrono for pesado, retentável ou externo.
- BullMQ executa o job; não substitui a garantia transacional do outbox.

## Camadas E Dependências

Permitido:

- `shared/jobs` importar `@nestjs/bullmq` e `bullmq`;
- infraestrutura de módulos futuros importar BullMQ;
- aplicação futura depender de ports/interfaces próprios do módulo.

Não permitido:

- domínio importar BullMQ;
- entidades ou value objects conhecerem filas;
- controllers chamarem `Queue.add` diretamente;
- use cases dependerem de `Queue` concreto quando houver regra de negócio envolvida.

## Testes

Testes sugeridos:

- teste unitário de `queue.config.ts` para fallback de `BULLMQ_*` para `REDIS_*`;
- teste de validação Joi para defaults e valores inválidos;
- teste de wiring do `JobsModule` com `@nestjs/testing`, mockando config;
- build TypeScript para garantir imports e module registration.

Não testar BullMQ contra Redis real nesta spec.

## Documentação

Criar ou atualizar:

```text
docs/platform/queue-infrastructure.md
docs/platform/README.md
.env.exemple
```

A documentação deve explicar:

- como configurar Redis dedicado ou compartilhado;
- quais variáveis de ambiente existem;
- como uma feature futura deve registrar uma fila;
- como workers futuros devem respeitar `BULLMQ_WORKERS_ENABLED`;
- que esta infraestrutura não cria filas por si só.

## Impacto Em API/Swagger

Sem impacto em endpoints HTTP, DTOs de apresentação ou Swagger.

## Impacto Em Banco/Migrations

Sem migração de banco relacional.

BullMQ cria e gerencia suas próprias estruturas no Redis.

## Segurança

- Payloads de jobs futuros não devem carregar segredos.
- Jobs futuros devem carregar somente identificadores e dados mínimos necessários.
- Dados multi-tenant devem sempre ser resolvidos/validados por `userId`/ownership no momento da execução do worker.
- Configurações sensíveis como senha do Redis devem vir de ambiente, nunca hardcoded.
