---
area: platform
feature: queue-infrastructure
type: spec-decisions
status: approved
related:
  - ./requirements.md
  - ./design.md
---

# Decisions - Queue Infrastructure

## DEC-001 - Criar infraestrutura em shared/jobs

Status: accepted

Decision:
A infraestrutura base de BullMQ ficará em `api/src/shared/jobs`.

Reason:
O conceito exposto para o restante da aplicação é execução de jobs assíncronos. O nome `jobs` descreve melhor o propósito arquitetural do que `bullmq` ou `redis`, que são detalhes de infraestrutura.

Impact:
Módulos futuros importam uma infraestrutura de plataforma, sem acoplar a organização do código ao fornecedor da fila.

## DEC-002 - Não criar filas concretas nesta spec

Status: accepted

Decision:
Esta spec configura apenas BullMQ e o módulo base. Nenhuma fila, job, processor, producer ou módulo de notificações será criado.

Reason:
A necessidade atual é preparar a fundação reutilizável. Criar uma fila concreta agora misturaria infraestrutura transversal com uma feature de domínio ainda não aprovada.

Impact:
A implementação final será validada por configuração, wiring e documentação, não por consumo real de jobs.

## DEC-003 - Usar Outbox e BullMQ para responsabilidades diferentes

Status: accepted

Decision:
BullMQ não substitui o outbox. O outbox continua responsável por persistir eventos junto das transações; BullMQ será usado por features futuras para executar trabalhos assíncronos retentáveis.

Reason:
O outbox resolve consistência transacional. BullMQ resolve processamento assíncrono, retry, backoff e concorrência. Misturar essas responsabilidades reduziria previsibilidade.

Impact:
Features futuras podem reagir a eventos publicados pelo outbox e então enfileirar jobs, mantendo cada mecanismo em seu papel.

## DEC-004 - Preferir Redis dedicado para BullMQ

Status: accepted

Decision:
Ambientes não locais devem preferir Redis dedicado para BullMQ, configurado com `maxmemory-policy noeviction`.

Reason:
Filas precisam preservar chaves de jobs. Políticas de eviction voltadas para cache podem remover dados internos do BullMQ e quebrar confiabilidade.

Impact:
O ambiente local pode usar o Redis existente com database separado, mas documentação e deploy devem apontar para Redis dedicado quando a fila passar a ser parte crítica do sistema.

## DEC-005 - Configurar defaults globais, permitir override por fila

Status: accepted

Decision:
O módulo base define attempts, backoff e retenção padrão, mas filas futuras podem sobrescrever esses valores.

Reason:
Defaults evitam configuração repetida e reduzem risco de jobs sem retry. Overrides continuam necessários porque alguns jobs serão mais caros, mais sensíveis ou menos retentáveis que outros.

Impact:
Specs futuras de filas devem registrar explicitamente quando usarem política diferente do default.

## DEC-006 - Manter BullMQ fora do domínio

Status: accepted

Decision:
Domínio, entidades e value objects não podem importar BullMQ. Use cases também não devem depender diretamente de `Queue` concreto quando houver regra de negócio envolvida.

Reason:
BullMQ é infraestrutura. Manter esse limite preserva Clean Architecture e facilita troca, testes e evolução de jobs.

Impact:
Features futuras devem criar ports/interfaces na aplicação e implementações BullMQ na infraestrutura quando o enfileiramento fizer parte de um fluxo de negócio.
