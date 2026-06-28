---
area: platform
feature: queue-infrastructure
type: spec-requirements
status: approved
related:
  - ../../../../platform/README.md
  - ../../../../events/README.md
  - ../../../../auth/reference/redis-keys.md
---

# Requirements - Queue Infrastructure

## Objetivo

Preparar a infraestrutura base para filas e workers assíncronos usando BullMQ por trás de uma configuração centralizada no NestJS.

Esta spec cria apenas a fundação técnica para que módulos futuros consigam registrar filas, producers e workers com retry/backoff. Ela não cria nenhuma fila concreta, nenhum processor de domínio e nenhum módulo de notificações.

## Contexto

O backend já usa Redis com `ioredis` para cache, sessão, throttling e integrações internas. O projeto também já possui `AppEventsModule` e `OutboxModule` para publicação confiável de eventos de domínio.

BullMQ deve entrar como infraestrutura de execução assíncrona para trabalhos demorados, retentáveis ou processados fora do ciclo HTTP. A introdução deve respeitar Clean Architecture: módulos de domínio e aplicação não devem depender diretamente de APIs concretas do BullMQ.

## Escopo

Esta spec cobre:

- instalação e registro das dependências `bullmq` e `@nestjs/bullmq`;
- configuração centralizada de conexão e defaults de jobs;
- validação das variáveis de ambiente necessárias;
- criação de um módulo compartilhado de filas/jobs;
- convenções para nomes de filas e jobs futuros;
- abstrações base para producers e workers futuros;
- estratégia de retry, backoff, retenção e concorrência padrão;
- documentação técnica da infraestrutura;
- testes mínimos de configuração e wiring do módulo.

## Fora De Escopo

Esta spec não cobre:

- criação de qualquer fila concreta;
- criação de qualquer worker/processor concreto;
- envio de e-mail;
- módulo `notifications`;
- integração com provedores como SMTP, SES, Resend ou SendGrid;
- dashboard/admin UI para filas;
- flows de negócio que enfileiram jobs;
- migrações de banco de dados;
- mudança no contrato HTTP de endpoints existentes.

## Regras

- O sistema deve registrar BullMQ em um módulo de plataforma compartilhado.
- O módulo compartilhado deve esconder detalhes do BullMQ de módulos de domínio.
- Configurações de conexão, retry e retenção devem vir de `ConfigService`.
- O módulo base não deve registrar filas concretas.
- Filas futuras devem declarar nomes de filas e jobs por constantes centralizadas ou por contrato próprio do módulo consumidor.
- Producers futuros devem depender de portas de aplicação quando a fila representar um caso de uso de domínio.
- Workers futuros devem ficar na camada de infraestrutura do módulo que executa o job.
- Jobs futuros devem usar payloads versionáveis e serializáveis em JSON.
- Jobs futuros devem usar `jobId` determinístico quando houver requisito de idempotência/deduplicação.
- O Redis usado por BullMQ não deve usar política de eviction incompatível com filas confiáveis.

## Requisitos Funcionais

### REQ-001 - Registrar infraestrutura BullMQ

WHEN a aplicação iniciar
THE SYSTEM SHALL registrar a infraestrutura BullMQ por meio de um módulo compartilhado de plataforma.

### REQ-002 - Configurar conexão Redis para BullMQ

WHEN BullMQ for inicializado
THE SYSTEM SHALL usar host, porta, senha, database e prefixo definidos por configuração centralizada.

### REQ-003 - Validar ambiente

WHEN a aplicação carregar as variáveis de ambiente
THE SYSTEM SHALL validar as variáveis necessárias para BullMQ no schema central de configuração.

### REQ-004 - Expor defaults de jobs

WHEN uma fila futura registrar jobs sem opções próprias
THE SYSTEM SHALL disponibilizar defaults de attempts, backoff, retenção e remoção de jobs concluídos/falhos.

### REQ-005 - Permitir desligar workers por ambiente

WHEN `BULLMQ_WORKERS_ENABLED` estiver falso
THE SYSTEM SHALL permitir que a aplicação suba sem executar workers.

### REQ-006 - Não criar filas concretas

WHEN esta spec for implementada
THE SYSTEM SHALL NOT registrar filas de domínio, processors concretos ou producers concretos.

### REQ-007 - Preservar isolamento arquitetural

WHEN módulos futuros precisarem enfileirar jobs
THE SYSTEM SHALL permitir que eles dependam de abstrações próprias, sem importar BullMQ na camada de domínio.

### REQ-008 - Compatibilizar com Redis confiável

WHEN BullMQ usar Redis
THE SYSTEM SHALL documentar e configurar uma política compatível com filas confiáveis, preferencialmente Redis dedicado com `maxmemory-policy noeviction`.

## Edge Cases

- IF as variáveis BullMQ estiverem ausentes
THEN o boot deve falhar com erro de configuração claro.

- IF a senha do Redis for opcional em ambiente local
THEN a configuração deve tratar string vazia de forma explícita e testada.

- IF workers estiverem desabilitados
THEN producers futuros ainda podem enfileirar jobs, mas nenhum processor deve ser ativado nesse processo.

- IF o mesmo Redis for compartilhado com cache/sessão
THEN a documentação deve registrar o risco de eviction e recomendar Redis dedicado para BullMQ.

- IF uma fila futura precisar de defaults diferentes
THEN ela deve conseguir sobrescrever attempts, backoff, removeOnComplete, removeOnFail e concurrency.

## Critérios De Aceite

- Existem `requirements.md`, `design.md`, `tasks.md` e `decisions.md` para esta spec.
- A spec deixa explícito que nenhuma fila concreta será criada.
- O design define o módulo compartilhado de filas/jobs e seus arquivos esperados.
- O design define variáveis de ambiente e validação Joi.
- O design define estratégia para Redis compartilhado versus Redis dedicado.
- O design define como módulos futuros devem registrar filas/workers sem vazar BullMQ para domínio.
- As tasks incluem instalação de dependências, configuração, módulo base, documentação e testes.
