# Governança de testes E2E e integração — Decisões

## DEC-001 — Criar uma suíte de integração própria para alteração de senha

Status: accepted

Decision:
Criar `api/test/password-change-flow.integration-spec.ts` em vez de adicionar o
cenário a `api-worker-flow.integration-spec.ts`.

Reason:
A lacuna está na persistência e autenticação real da credencial. O fluxo
API/worker possui responsabilidade diferente e inclui BullMQ, worker e provider de
e-mail que não são necessários para essa prova.

Impact:
A falha fica localizada no domínio de autenticação e o teste pode ser executado
isoladamente. Em contrapartida, a suíte própria inicia containers adicionais no
job sequencial de integração.

Alternatives:

- adicionar ao fluxo API/worker, com menor startup e maior acoplamento;
- transformar o E2E HTTP em fluxo real, tornando `test:e2e` dependente de Docker.

## DEC-002 — Manter E2E de contrato sem infraestrutura externa

Status: accepted

Decision:
Preservar `change-password.e2e-spec.ts` como teste da borda HTTP e manter
PostgreSQL/Redis exclusivamente na suíte de integração.

Reason:
Controller, DTO, pipes, filtro, cookies e `Retry-After` já são verificáveis sem
subir infraestrutura. A CI separa explicitamente E2E leve de integração com
Testcontainers.

Impact:
`npm run test:e2e` continua rápido e executável sem Docker. A confiança completa
surge da composição das duas suítes, não de um único arquivo monolítico.

## DEC-003 — Usar somente PostgreSQL e Redis no novo fluxo

Status: accepted

Decision:
O novo teste inicia um PostgreSQL 16 e um Redis 7. Não inicia worker, BullMQ Redis,
Toxiproxy ou provider externo.

Reason:
O caso de uso grava eventos na outbox de forma síncrona, reconstrói a projeção e
remove sessões diretamente. Processamento assíncrono e envio já pertencem a outras
suítes.

Impact:
Reduz tempo, superfície de falha e configuração. O teste comprova a emissão, mas
não o consumo dos eventos.

## DEC-004 — Usar componentes reais e evitar mocks internos

Status: accepted

Decision:
Compor repositories TypeORM, decorator de cache, bcrypt, policy, state store,
sessões e outbox reais. Somente configurações puras recebem valores sintéticos.

Reason:
O defeito que se pretende detectar está justamente entre mapper, cascade,
repository, cache e persistência. Mockar essas fronteiras repetiria a lacuna do E2E
atual.

Impact:
O teste fica mais lento que um unitário, mas falha diante de regressões reais de
integração e não apenas de chamadas esperadas em mocks.

## DEC-005 — Não compartilhar containers vivos entre arquivos Jest

Status: accepted

Decision:
Cada suíte mantém seu próprio ciclo de vida de containers. Helpers podem reduzir
duplicação de configuração, mas não compartilhar estado ou processos vivos.

Reason:
O compartilhamento global reduz startup, porém aumenta acoplamento, risco de ordem
implícita e complexidade de cleanup. O job atual possui ampla margem em relação ao
timeout.

Impact:
Há custo adicional de startup. A decisão deve ser reavaliada somente com medição
que demonstre problema real.

## DEC-006 — Criar documentação individual por suíte

Status: accepted

Decision:
Criar uma página curta para cada `*.e2e-spec.ts` e `*.integration-spec.ts`, além de
índices e matriz de dependências em `docs/tests`.

Reason:
Uma relação um-para-um torna claro qual documento deve mudar junto de cada suíte e
evita um catálogo único excessivamente denso.

Impact:
Renomear, remover ou alterar uma suíte passa a exigir atualização explícita de sua
página e dos índices.

## DEC-007 — Criar skill local em vez de ampliar o AGENTS.md

Status: accepted

Decision:
Criar `.agents/skills/test-suite-governance` com checklist de impacto em referência
separada. Não duplicar a política completa no `AGENTS.md`.

Reason:
A skill possui trigger específico, pode ser versionada com o projeto e usa
divulgação progressiva. O `AGENTS.md` deve permanecer focado nas regras globais e
não carregar um procedimento extenso em todas as tarefas.

Impact:
Agentes trabalhando em E2E, integração, Jest ou pipeline recebem o fluxo
especializado. Se a descoberta automática não funcionar, será necessária nova
decisão para adicionar uma chamada curta no `AGENTS.md`.

## DEC-008 — Não alterar a pipeline antes da medição

Status: accepted

Decision:
Usar o job `integration` e o regex Jest existentes sem mudar o workflow. Medir a
suíte completa depois da implementação e só considerar alteração mediante problema
observado.

`npm run test:integration` permanece o único comando agregado da categoria e deve
executar todas as suítes `*.integration-spec.ts`. Não será criado script exclusivo
para o fluxo de alteração de senha nem filtro de arquivo na CI.

Reason:
As imagens e Testcontainers já estão disponíveis. O baseline observado foi 1m39s
para um timeout de 20 minutos; aumentar timeout ou paralelizar agora seria
prematuro.

Impact:
O novo arquivo será descoberto automaticamente e aumentará apenas a duração e o
consumo do job existente. Qualquer mudança posterior exige comunicação, atualização
desta spec e da spec de backend CI antes do YAML.

Validation:
A execução agregada final aprovou 9 suítes e 36 testes em 68,47s totais, contra
timeout de 20 minutos. A pipeline permaneceu inalterada.
