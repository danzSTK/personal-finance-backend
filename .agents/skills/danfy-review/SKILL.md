---
name: danfy-review
description: Revisao completa de mudancas, commits ou PRs do backend Danfy. Use quando o usuario pedir code review, PR review, revisao de mudancas nao commitadas/staged, auditoria antes de merge ou analise de aderencia arquitetural e de documentacao.
---

# Danfy Review

Revisao tecnica de alta precisao para o backend da Danfy, compativel com Codex e Claude Code.

## Idioma e Formato de Saida

- Responda em **portugues** por padrao.
- Se o usuario ou o sistema fornecer um schema de saida (ex.: JSON estruturado), siga **exatamente** o schema pedido, sem texto extra fora dele.
- Sem schema especifico, apresente os achados priorizados por severidade (**P0** bloqueador de merge, **P1** importante, **P2** risco relevante/lacuna de teste ou documentacao).
- Nao repita o checklist inteiro na resposta; reporte apenas achados concretos (ou, se nao houver achados, registre explicitamente riscos residuais, lacunas de teste e o que foi verificado na documentacao).

## Fluxo Obrigatorio de Revisao

Execute as etapas abaixo nesta ordem antes de emitir qualquer parecer:

### 1. Mapeamento do Diff e Descoberta de Contexto
1. Liste os arquivos adicionados, modificados ou removidos no escopo revisado.
2. Identifique os modulos afetados em `api/src/modules/<modulo>/`, `api/src/shared/`, `api/src/app/`, `api/src/database/`, `api/test/`, `docs/` e `.github/`.
3. Leia obrigatoriamente:
   - `AGENTS.md` (secao `## Code Review Rules` e invariantes aplicaveis);
   - o `api/src/modules/<modulo>/AGENTS.md` de **cada** modulo tocado;
   - `docs/architecture/module-boundaries.md` quando houver importacoes ou interacoes entre modulos;
   - a spec correspondente em `docs/specs/<modulo>/<feature>/specs/` (`requirements.md`, `design.md`, `decisions.md`), quando existir.

### 2. Triagem para Skills Especializadas
Ative e aplique integralmente as skills especializadas conforme o conteudo do diff:

- **Mudancas de banco ou SQL** (`api/src/database/migrations/`, `*-orm.entity.ts`, `*-orm-entity.ts`, `sql/`, `queryRunner.query`, `manager.query`, `createQueryBuilder`, `docs/database/`):
  - aplique `database-review` (comparacao com `docs/database/schema.md` e migrations historicas + validacao de modelagem logica PostgreSQL + seguranca/performance de queries);
  - aplique `migration-rollout` para compatibilidade N/N+1 (`expand -> migrate -> contract`) e `docs/architecture/compatibility.md`.
- **Seguranca** (nova feature, novos endpoints, alteracoes em guards/decorators de bypass, auth/sessoes/OAuth, leituras/mutacoes multi-tenant, DTOs, uploads/assets/R2, filas/outbox, `api/src/config/`, `.env.exemple`, `package.json`, Dockerfiles, workflows ou `.trivyignore`):
  - aplique `security-review` e valide contra `docs/security/README.md`.
- **Erros, Testes e E-mails**:
  - alteracoes em erros lancados ou filtro global -> valide contra `platform-errors` e `docs/errors/README.md`;
  - criacao/alteracao de testes E2E ou de integracao -> valide contra `test-suite-governance` e `docs/tests/README.md`;
  - alteracoes em templates HTML de e-mail -> valide contra `email-template-constructor`.

### 3. Revisao Arquitetural, Confiabilidade e Invariantes
Leia `references/architecture-review.md` e verifique:
- direcao de dependencia e separacao de camadas (`domain` -> `application` -> `infrastructure`/`presentation`);
- limites entre modulos e separacao de processos (`PROCESS_ROLE=api` vs `PROCESS_ROLE=worker`), respeitando excecoes/dividas registradas (`DT-01`, `DT-02`, `DT-03`) em codigo intocado, mas bloqueando **novas** violacoes;
- invariantes financeiras (centavos inteiros seguros `bigint`/`Number.isSafeInteger()`, `amountCents > 0`, saldo derivado, `TRANSFER` nao deletavel) e temporais (`DateOnly` vs `Instant`);
- atomicidade transacional (`options.manager` propagado, bypass de cache em transacoes, locks) e efeitos externos duraveis (Transactional Outbox, `DELETE_PENDING` + reconciler);
- compatibilidade de contratos HTTP (`object` discriminator, mudancas aditivas, codigos de erro estaveis) e testes proporcionais ao risco.

### 4. Auditoria de Alinhamento e Lag de Documentacao (Obrigatorio)
Leia `references/documentation-alignment.md` e compare **as mudancas feitas no codigo** contra a documentacao existente no repositorio:
- identifique **ausencia de documentacao** (ex.: nova regra de negocio, endpoint, erro publico, evento, tabela/coluna, shim de compatibilidade, variavel de ambiente ou suite de integracao sem o documento correspondente);
- identifique **lag/drift de documentacao** (ex.: o codigo alterou comportamento, contrato, invariante, schema, guard ou limite, mas `docs/<modulo>/`, `docs/specs/`, `docs/database/schema.md`, `docs/architecture/compatibility.md`, `docs/integrations/`, `docs/configuration.md`, `.env.exemple`, `docs/tests/` ou `api/src/modules/<modulo>/AGENTS.md` continuam descrevendo o comportamento antigo).
- reporte cada ausencia ou lag apontando o arquivo de codigo alterado, o documento faltante ou desatualizado e o trecho/contrato que ficou divergente.

## Padrao de Cada Achado

Para cada achado reportado, informe objetivamente:
1. **Severidade (`P0` / `P1` / `P2`) e Categoria** (ex.: Seguranca, Banco/SQL, Arquitetura, Corretude, Documentacao, Testes).
2. **Localizacao:** arquivo e linha afetados (e documento/spec divergente, quando aplicavel).
3. **Invariante ou documento violado:** cite a regra exata de `AGENTS.md` ou do documento autoritativo.
4. **Cenario concreto de falha:** como o bug, vulnerabilidade, regressao ou drift se manifesta na pratica.
5. **Caminho seguro:** correcao objetiva alinhada aos padroes do repositorio.

## Anti-Ruido

- Deixe formatacao, imports e lint deterministico para o CI (`format:check`, `lint:check`, `typecheck`).
- Nao reporte preferencias estilisticas sem risco concreto.
- Nao sinalize codigo legado intocado ja documentado como divida tecnica (`DT-01..03`), exceto quando o PR expandir ou replicar o acoplamento.
- Nao aprove apenas porque build e testes passaram.

## References

- `references/architecture-review.md` — Checklist detalhado de arquitetura, dominio, transacoes, cache, outbox, erros e contratos.
- `references/documentation-alignment.md` — Matriz de mapeamento entre mudancas de codigo e documentacao obrigatoria para deteccao de ausencia e lag documental.
