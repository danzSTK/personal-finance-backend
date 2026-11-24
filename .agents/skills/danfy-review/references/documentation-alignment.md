# Matriz de Alinhamento e Lag de Documentacao (Danfy)

Use esta referencia durante o `danfy-review` para comparar as alteracoes feitas no codigo contra a documentacao do repositorio e sinalizar **ausencia** ou **lag (desatualizacao/drift)**.

---

## 1. Como Auditar Alinhamento Documental

1. Classifique cada arquivo alterado no diff conforme a matriz abaixo.
2. Abra e leia os documentos correspondentes existentes no repositorio.
3. Compare o comportamento/contrato/schema **novo** no diff com o que esta escrito nos documentos marcados como `status: current` (e specs ativas em `docs/specs/`).
4. Classifique o achado como:
   - **Ausencia de documentacao:** o PR introduz capacidade, contrato, erro, evento, variavel de ambiente, tabela ou suite de teste nova sem criar o registro/documento exigido pelo padrao do projeto.
   - **Lag / Drift documental:** o PR altera regra de negocio, fluxo, schema, contrato HTTP, guard, compatibilidade ou fronteira de modulo, deixando um documento existente contraditorio com o codigo atual.

---

## 2. Matriz Mudanca -> Documentacao Obrigatoria

| O que mudou no codigo | Documentos que DEVEM ser verificados e mantidos sincronizados |
| --- | --- |
| Nova feature ou mudanca relevante de regra de negocio | `docs/specs/<modulo>/<feature>/specs/{requirements.md, design.md, tasks.md, decisions.md}` e `docs/<modulo>/` (`concepts/`, `flows/`, `decisions/`, `reference/invariants.md`, `README.md`) |
| Regras de fronteira, invariantes ou fluxo principal de um modulo (`api/src/modules/<m>/`) | `api/src/modules/<m>/AGENTS.md` e `docs/<m>/README.md` (mais `docs/architecture/module-boundaries.md` se afetar acoplamento entre modulos ou `DT-01..03`) |
| Migrations (`api/src/database/migrations/`) ou ORM entities (`*-orm.entity.ts`) | `docs/database/schema.md` (obrigatorio para qualquer tabela, coluna, constraint, indice, trigger, funcao ou enum) e `docs/architecture/compatibility.md` (quando criar/atualizar/aposentar shim N/N+1 ou gate de contract) |
| Endpoints HTTP, Request/Response DTOs, status HTTP, headers ou `object` discriminators | `docs/integrations/` (contratos do modulo), `docs/<modulo>/reference/endpoints.md` (quando existir) e `docs/platform/response-objects.md` (se criar novo padrao/chave de `object`) |
| Novos `DomainError` / `ApplicationError` ou mapeamentos em `AppExceptionFilter` | `docs/integrations/errors.md`, `docs/auth/reference/error-codes.md` (quando de auth) e `docs/errors/README.md` (se mudar mecanismo global) |
| Eventos de dominio, Transactional Outbox ou filas/jobs BullMQ | `docs/events/README.md`, `docs/events/<evento>.md`, `docs/platform/queue-infrastructure.md` e `docs/platform/worker-operations.md` |
| Templates de e-mail (`api/email-templates/` ou catalogo de `notifications`) | `docs/notifications/README.md` e `docs/notifications/email-templates/` |
| Guards globais, decorators de bypass, autenticacao, cookies, throttling, CORS/Helmet, uploads/R2 | `docs/security/README.md` e `docs/auth/` (`concepts/`, `flows/`, `reference/{cookies,throttling,redis-keys}.md`) |
| Variaveis de ambiente ou arquivos em `api/src/config/` | `.env.exemple`, `docs/configuration.md` e `api/test/fixtures/container-smoke.env` (quando obrigatoria no boot/CI) |
| Scripts em `api/package.json`, composicao `api`/`worker`, Dockerfiles ou `.github/workflows/` | `docs/commands.md`, `docs/architecture.md`, `docs/platform/continuous-integration.md`, `docs/platform/continuous-delivery.md` e `docs/deploy.md` |
| Suites E2E ou de integracao (`api/test/*.e2e-spec.ts`, `*.integration-spec.ts`, `jest-*.json`) | `docs/tests/README.md` e o guia correspondente em `docs/tests/e2e/` ou `docs/tests/integration/` (conforme `test-suite-governance`) |

---

## 3. Calibracao de Severidade para Documentacao

- **P1 (Importante / Corrigir antes do merge):**
  - alteracao de schema/migration sem atualizar `docs/database/schema.md` ou sem registrar shim/gate em `docs/architecture/compatibility.md`;
  - mudanca de contrato HTTP, codigo de erro publico, evento/job ou variavel de ambiente obrigatoria que deixa `docs/integrations/`, `docs/events/`, `docs/configuration.md` ou `.env.exemple` contraditorio;
  - mudanca de regra de negocio, seguranca ou limite de modulo que contradiz `status: current` em `docs/<modulo>/`, `docs/security/README.md`, `docs/architecture/module-boundaries.md` ou `api/src/modules/<m>/AGENTS.md`;
  - nova feature relevante sem spec ou com `requirements.md`/`design.md`/`decisions.md` em desacordo com a implementacao entregue.
- **P2 (Lacuna relevante):**
  - documento novo criado em `docs/<modulo>/` que nao foi linkado no `docs/<modulo>/README.md` ou esta sem frontmatter YAML (`area`, `type`, `status`);
  - documento substituido que nao foi marcado como `historical`/`deprecated` com `superseded_by`;
  - ausencia de atualizacao em `docs/tests/` apos adicionar/alterar dependencia ou finalidade de suite de teste.
- **Nao reportar (Ruido):**
  - refatoracoes puramente internas (renomear variavel privada, extrair metodo auxiliar, ajustar teste unitario interno) que preservam integralmente comportamento, contratos, schema e fronteiras.
