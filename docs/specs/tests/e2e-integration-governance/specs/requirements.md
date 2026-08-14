# Governança de testes E2E e integração — Requisitos

## Objetivo

Preencher a lacuna de evidência integrada da alteração de senha e estabelecer um
padrão permanente para criação, alteração e documentação de testes E2E e de
integração que dependam de infraestrutura.

O novo teste deve provar o comportamento real entre domínio, aplicação,
PostgreSQL e Redis sem transformar a suíte E2E atual em uma suíte dependente de
Docker.

## Contexto

- A alteração de senha está especificada em
  `docs/specs/auth/change-password/specs/`.
- O critério de aceite exige que a senha anterior deixe de autenticar, a nova
  passe a autenticar e sessões/tokens anteriores sejam invalidados.
- `api/test/change-password.e2e-spec.ts` valida o contrato HTTP com o caso de uso
  mockado.
- `api/test/password-change-postgres.integration-spec.ts` valida schema,
  constraints e índices, mas não executa a troca real da credencial.
- A CI já possui um job de integração com Docker e Testcontainers.
- Em 13 de agosto de 2026, o job de integração da PR 69 concluiu em 1 minuto e
  39 segundos, com timeout configurado em 20 minutos.

## Terminologia

- **Teste E2E de contrato HTTP:** inicializa uma aplicação NestJS HTTP e valida
  request, response, pipes, filtros, headers e cookies. Pode substituir casos de
  uso quando o objetivo declarado for somente o contrato da borda.
- **Teste de integração:** executa componentes reais de duas ou mais camadas ou
  dependências, como repositories TypeORM, PostgreSQL, Redis ou BullMQ.
- **Dependência de execução:** serviço, binário, container, credencial, rede ou
  recurso necessário para uma suíte executar, além de Node.js e das dependências
  instaladas pelo lockfile.
- **Dependência nova:** dependência de execução ou pacote que ainda não é
  provisionado no comando local e no job de CI responsável pela suíte.

## Escopo

- Criar uma suíte de integração própria para o fluxo real de alteração de senha.
- Usar PostgreSQL 16 e Redis 7 descartáveis por Testcontainers.
- Exercitar implementações reais do caso de uso, hash, repositories, cache,
  projeção de estado, auditoria, outbox e sessões.
- Validar a autenticação com a senha antiga e com a nova usando o fluxo de
  validação de credenciais da aplicação.
- Validar a revogação lógica por `credentialVersion` e a remoção física das
  sessões anteriores.
- Criar o módulo documental `docs/tests/` com catálogos de E2E e integração.
- Documentar todas as suítes atuais em `api/test/`, seus objetivos e suas
  dependências.
- Criar uma skill local do projeto que governe criação e alteração de testes E2E
  e de integração.
- Avaliar e registrar o impacto na pipeline antes e depois da implementação.
- Alterar a pipeline somente se a execução real demonstrar necessidade e após
  atualizar esta spec e comunicar o impacto ao responsável pelo projeto.

## Fora de escopo

- Alterar regras de negócio da troca de senha.
- Alterar o endpoint, DTOs ou contrato HTTP.
- Criar migration ou modificar schema.
- Executar o frontend, browser ou Playwright.
- Enviar e-mail real ou acessar a Brevo.
- Processar os eventos pelo worker; o fluxo genérico API/worker já possui suíte
  própria.
- Criar um módulo NestJS de produção chamado `tests`.
- Compartilhar containers vivos globalmente entre arquivos Jest.
- Adicionar threshold global de cobertura.

## Requisitos funcionais

### RF-01 — Classificação da suíte

WHEN o teste do fluxo real de alteração de senha for criado, THE SYSTEM SHALL
armazená-lo em `api/test/password-change-flow.integration-spec.ts` e executá-lo
pelo comando `npm run test:integration`.

O teste não deve ser incluído em `*.e2e-spec.ts`, pois possui dependências reais
de PostgreSQL e Redis.

`npm run test:integration` é o comando canônico e deve executar, na mesma
invocação, todos os arquivos `api/test/*.integration-spec.ts`, incluindo
`api-worker-flow.integration-spec.ts`, as integrações já existentes e a nova
suíte. Nenhum teste de integração pode depender de um script paralelo ou comando
exclusivo para participar da CI.

### RF-02 — Credencial real

WHEN o cenário de sucesso for executado, THE TEST SHALL:

1. criar um usuário de teste com provider `EMAIL` e senha antiga conhecida;
2. comprovar que a senha antiga autentica antes da alteração;
3. executar `ChangeUserPasswordUseCase` com implementações reais;
4. comprovar que a senha antiga não autentica depois da alteração;
5. comprovar que a senha nova autentica;
6. comprovar que o hash persistido mudou e corresponde somente à senha nova;
7. comprovar que `credential_version` foi incrementada exatamente uma vez.

Nenhuma asserção pode expor ou registrar o hash completo como diagnóstico.

### RF-03 — Persistência, auditoria e outbox

WHEN a alteração concluir, THE TEST SHALL verificar pelo estado observável que:

- existe exatamente um fato `PASSWORD_CHANGED` para o usuário;
- os eventos de outbox esperados foram gravados na mesma operação lógica;
- os payloads de outbox não contêm senha atual, senha nova ou hash;
- a projeção operacional do Redis contém a alteração concluída;
- não existe barreira de mutação pendente após a finalização.

### RF-04 — Sessões e tokens anteriores

GIVEN uma sessão Redis e payloads de access e refresh token com a versão anterior,
WHEN a senha for alterada, THE TEST SHALL comprovar que:

- a sessão anterior foi removida do Redis;
- a strategy de access token rejeita a versão anterior;
- a strategy de refresh token rejeita a versão anterior;
- a rejeição decorre do estado real persistido, sem mock do repository de usuário.

### RF-05 — Isolamento e determinismo

Cada cenário deve:

- criar seus próprios identificadores e dados;
- poder executar isoladamente;
- não depender da ordem dos outros testes;
- aguardar promises explicitamente;
- não usar `setTimeout`;
- limpar conexões e containers em sucesso ou falha;
- usar apenas dados sintéticos.

### RF-06 — Dependências do novo teste

O novo teste deve depender somente de:

- Node.js 22 e dependências do `api/package-lock.json`;
- Docker acessível ao Testcontainers;
- imagem `postgres:16-alpine`;
- imagem `redis:7-alpine`.

BullMQ Redis, worker, Toxiproxy, frontend, Brevo e acesso externo não devem ser
necessários para essa suíte.

### RF-07 — Módulo documental de testes

WHEN esta entrega for implementada, THE SYSTEM SHALL criar:

```text
docs/tests/
├── README.md
├── e2e/
│   ├── README.md
│   ├── app.md
│   └── change-password.md
├── integration/
│   ├── README.md
│   ├── api-worker-flow.md
│   ├── bullmq-redis.md
│   ├── email-template-registry-postgres.md
│   ├── outbox-postgres.md
│   ├── password-change-flow.md
│   ├── password-change-postgres.md
│   ├── password-change-redis.md
│   ├── process-config.md
│   └── worker-health-recovery.md
└── reference/
    └── suite-documentation-template.md
```

Cada documento de suíte deve informar:

- arquivo executável correspondente;
- classificação e objetivo;
- cenários e comportamentos comprovados;
- componentes reais e componentes mockados;
- dependências de execução e versões relevantes;
- forma de provisionamento e cleanup;
- necessidade de Docker, rede ou credenciais;
- comando local e job de CI;
- falhas esperadas de ambiente;
- responsabilidades de manutenção.

### RF-08 — Catálogo atual

O catálogo deve incluir todos os arquivos atuais:

- `api/test/app.e2e-spec.ts`;
- `api/test/change-password.e2e-spec.ts`;
- `api/test/api-worker-flow.integration-spec.ts`;
- `api/test/bullmq-redis.integration-spec.ts`;
- `api/test/email-template-registry-postgres.integration-spec.ts`;
- `api/test/outbox-postgres.integration-spec.ts`;
- `api/test/password-change-postgres.integration-spec.ts`;
- `api/test/password-change-redis.integration-spec.ts`;
- `api/test/process-config.integration-spec.ts`;
- `api/test/worker-health-recovery.integration-spec.ts`;
- o novo `api/test/password-change-flow.integration-spec.ts`.

### RF-09 — Skill de governança

WHEN um agente criar, remover ou modificar um teste E2E ou de integração, THE
AGENT SHALL usar a skill local `test-suite-governance`.

A skill deve exigir:

1. leitura do catálogo de testes e da suíte afetada;
2. classificação correta entre unitário, E2E de contrato e integração;
3. inventário de dependências antes da alteração;
4. análise de disponibilidade local e na CI;
5. análise de rede, credenciais, imagens, portas, cleanup, timeout e custo;
6. comunicação prévia quando uma alteração de pipeline for necessária;
7. atualização do documento da suíte na mesma mudança;
8. criação de documento e estudo de impacto quando surgir dependência nova;
9. validação dos comandos local e de CI aplicáveis.

### RF-10 — Mudanças e remoções

WHEN uma suíte documentada mudar comportamento, dependências, mocks, comando,
provisionamento ou cleanup, THE SYSTEM SHALL atualizar sua documentação na mesma
entrega.

WHEN uma suíte for removida ou renomeada, THE SYSTEM SHALL remover ou renomear o
documento correspondente e atualizar os índices.

### RF-11 — Impacto na pipeline

O novo arquivo deve ser descoberto automaticamente por
`api/test/jest-integration.json` e executado pelo job `integration` existente.

O job deve continuar chamando somente `npm run test:integration` como porta de
entrada da categoria. Filtros por arquivo são permitidos apenas para diagnóstico
local e não constituem validação final.

Não deve haver alteração inicial em `.github/workflows/backend-ci.yml`.

IF a medição após implementação indicar timeout, indisponibilidade de dependência,
flakiness ou consumo incompatível com o runner, THEN a implementação deve parar,
esta spec e a spec de backend CI devem ser atualizadas e o impacto deve ser
comunicado antes de modificar o workflow.

## Casos limite e falhas de ambiente

- Docker indisponível deve ser identificado como falha de ambiente, não como
  falha da regra de negócio.
- Falha ao baixar uma imagem deve indicar a imagem necessária sem revelar
  credenciais.
- Portas devem ser efêmeras; o teste não pode exigir `5432` ou `6379` livres.
- O teste não pode depender de `.env` local.
- Os containers devem ser finalizados em `afterAll`, inclusive após falha de
  asserção.
- O Redis deve ser limpo entre cenários ou usar chaves isoladas por usuário.
- Registros de um cenário não podem ser usados como preparação de outro.
- Logs e mensagens de falha não devem imprimir senhas, hashes, JWTs ou secrets.

## Critérios de aceite

- A nova suíte falha se o cascade do provider deixar de persistir o novo hash.
- A nova suíte falha se cache ou repository continuarem autenticando a senha
  antiga.
- A nova suíte falha se `credentialVersion`, auditoria, outbox, projeção ou
  revogação de sessão deixarem de ocorrer.
- `npm run test:e2e` continua sem depender de Docker ou serviços reais.
- `npm run test:integration` executa a nova suíte com Testcontainers.
- A mesma execução de `npm run test:integration` continua executando todas as
  outras suítes de integração, inclusive `api-worker-flow.integration-spec.ts`.
- Nenhuma dependência npm ou serviço novo é introduzido.
- A pipeline permanece sem alteração, salvo nova decisão explicitamente aprovada.
- Todas as suítes E2E e integração possuem documentação correspondente.
- A skill local é validada pelo `quick_validate.py` do `skill-creator`.
- A documentação e a skill tornam obrigatória a análise de impacto e a
  atualização documental em mudanças futuras.
