# Governança de testes E2E e integração — Tarefas

## 1. Descoberta e especificação

- [x] Inventariar arquivos E2E e de integração existentes em `api/test/`.
- [x] Mapear Testcontainers, imagens, processos, comandos Jest e jobs da CI.
- [x] Confirmar que o E2E atual de alteração de senha mocka o caso de uso.
- [x] Confirmar a lacuna de persistência e autenticação real.
- [x] Medir o baseline remoto do job de integração e registrar o timeout atual.
- [x] Criar `requirements.md`, `design.md`, `tasks.md` e `decisions.md`.
- [x] Revisar e aprovar esta spec antes da implementação.

## 2. Módulo documental

- [x] Criar `docs/tests/README.md` com taxonomia, comandos, CI e política de
      manutenção.
- [x] Criar `docs/tests/reference/suite-documentation-template.md`.
- [x] Criar o índice `docs/tests/e2e/README.md`.
- [x] Documentar `app.e2e-spec.ts`.
- [x] Documentar `change-password.e2e-spec.ts`, incluindo seus mocks e limites.
- [x] Criar o índice e a matriz de dependências em
      `docs/tests/integration/README.md`.
- [x] Documentar `api-worker-flow.integration-spec.ts`.
- [x] Documentar `bullmq-redis.integration-spec.ts`.
- [x] Documentar `email-template-registry-postgres.integration-spec.ts`.
- [x] Documentar `outbox-postgres.integration-spec.ts`.
- [x] Documentar `password-change-postgres.integration-spec.ts`.
- [x] Documentar `password-change-redis.integration-spec.ts`.
- [x] Documentar `process-config.integration-spec.ts`.
- [x] Documentar `worker-health-recovery.integration-spec.ts`.
- [x] Atualizar `docs/platform/continuous-integration.md` com o link para o
      catálogo de suítes.

## 3. Skill de governança

- [x] Inicializar `.agents/skills/test-suite-governance` usando o
      `init_skill.py` do `skill-creator`.
- [x] Definir trigger para criação, modificação, renomeação e remoção de E2E,
      integração, configurações Jest e passos correspondentes da CI.
- [x] Escrever um `SKILL.md` conciso com o fluxo obrigatório de análise e
      atualização documental.
- [x] Criar `references/dependency-impact-checklist.md` com disponibilidade
      local/CI, rede, secrets, imagens, portas, cleanup, timeout, custo e falhas.
- [x] Gerar `agents/openai.yaml` coerente com a skill.
- [x] Validar a skill com `quick_validate.py`.
- [x] Fazer uma aplicação controlada da skill sobre o novo teste e corrigir
      ambiguidades encontradas.

## 4. Infraestrutura do teste

- [x] Criar `api/test/password-change-flow.integration-spec.ts` com um único
      `describe` raiz.
- [x] Confirmar que o novo arquivo é descoberto pelo regex agregado de
      `jest-integration.json`, sem criar script exclusivo.
- [x] Iniciar PostgreSQL 16 e Redis 7 descartáveis com portas efêmeras.
- [x] Inicializar `DataSource` com `ENTITIES` e migrations reais.
- [x] Compor hash, repositories, decorator de cache, invalidator, state store,
      policy, outbox e sessões reais.
- [x] Compor os casos de uso de alteração e validação de credenciais reais.
- [x] Compor as strategies JWT com configuração exclusivamente sintética.
- [x] Implementar factory/fixture local para usuário `EMAIL`, sessão e contexto de
      segurança sem adicionar métodos de produção exclusivos para teste.
- [x] Garantir teardown seguro após inicialização completa ou parcial.

## 5. Cenários de integração

- [x] Comprovar que a senha antiga autentica antes da alteração.
- [x] Executar a alteração de senha pelo `ChangeUserPasswordUseCase` real.
- [x] Comprovar que o hash persistido mudou e reconhece somente a senha nova.
- [x] Comprovar que a senha antiga falha e a nova autentica após a alteração.
- [x] Comprovar o incremento exato de `credential_version`.
- [x] Comprovar o fato `PASSWORD_CHANGED` e a coerência temporal.
- [x] Comprovar os três eventos esperados na outbox e ausência de dados sensíveis.
- [x] Comprovar reconstrução da projeção Redis e remoção da barreira pendente.
- [x] Comprovar remoção física das sessões anteriores.
- [x] Comprovar rejeição dos payloads antigos pelas strategies de access e refresh.
- [x] Garantir independência entre cenários, sem `setTimeout` ou ordem implícita.

## 6. Documentação do novo teste

- [x] Criar `docs/tests/integration/password-change-flow.md` a partir do template.
- [x] Registrar PostgreSQL, Redis, Docker, imagens, provisioning, cleanup e
      comandos.
- [x] Registrar componentes reais, configurações sintéticas e itens fora de
      escopo.
- [x] Adicionar a suíte aos índices e à matriz de dependências.
- [x] Conferir todos os caminhos documentados com os arquivos reais.

## 7. Validação e impacto da pipeline

- [x] Executar a nova suíte isoladamente.
- [x] Executar `npm run test:integration` completo, confirmar a execução de todas
      as suítes existentes — inclusive `api-worker-flow` — e registrar duração e
      consumo observados.
- [x] Executar `npm run test:e2e` e confirmar que a suíte continua sem Docker.
- [x] Comparar o resultado com o baseline de 1m39s e o timeout de 20 minutos.
- [x] Confirmar que não houve nova dependência npm, imagem ou serviço.
- [x] Executar `lint:check`, `typecheck` e `build`.
- [x] Validar que nenhuma mensagem de falha expõe senha, hash, JWT ou secret.
- [x] Atualizar a evidência de testes na spec de change password.
- [ ] Atualizar a descrição da PR 69 após commit, push e aprovação dos checks
      remotos.

## 8. Condição excepcional de mudança da CI

- [x] IF a medição revelar timeout, flakiness ou indisponibilidade, parar antes de
      editar `.github/workflows/backend-ci.yml`.
- [x] Registrar que as demais tarefas condicionais desta seção não se aplicam: a
      medição confirmou ampla margem e nenhuma mudança de CI foi necessária.
