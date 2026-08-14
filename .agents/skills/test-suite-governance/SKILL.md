---
name: test-suite-governance
description: Governa criação, alteração, renomeação e remoção de testes E2E e de integração deste backend, incluindo arquivos api/test/*.e2e-spec.ts, api/test/*.integration-spec.ts, configurações Jest, dependências de execução e passos correspondentes da CI. Use para classificar a suíte, avaliar impacto local e na pipeline, impedir dependências indisponíveis e manter docs/tests sincronizado.
---

# Governança de suítes de teste

Preservar a separação entre testes leves e testes com infraestrutura real. Tratar
o teste, suas dependências, a pipeline e a documentação como uma única mudança.

## Fluxo obrigatório

1. Ler `docs/tests/README.md`, o índice da categoria e a página da suíte afetada.
2. Ler o teste, `api/test/jest-e2e.json`, `api/test/jest-integration.json`, os
   scripts de `api/package.json` e `.github/workflows/backend-ci.yml` conforme o
   escopo.
3. Classificar o cenário:
   - usar E2E para contrato HTTP iniciado pelo NestJS e sem serviço real;
   - usar integração quando PostgreSQL, Redis, BullMQ, Toxiproxy, processos ou
     outra implementação externa real participarem;
   - manter unitários fora de `api/test/` conforme as regras do repositório.
4. Comparar as dependências antes e depois. Para qualquer dependência nova, ler
   [dependency-impact-checklist.md](references/dependency-impact-checklist.md) e
   registrar o estudo na spec ativa antes de implementar.
5. Confirmar disponibilidade local e no job responsável. Não supor que uma
   dependência existente em outro job esteja disponível.
6. Comunicar ao usuário antes de editar a pipeline quando for necessário alterar
   serviço, imagem, secret, permissão, runner, timeout, paralelismo ou comando.
7. Implementar testes independentes, determinísticos, com dados sintéticos,
   teardown seguro e sem `setTimeout`.
8. Atualizar na mesma mudança:
   - a página correspondente em `docs/tests/e2e/` ou
     `docs/tests/integration/`;
   - o índice e a matriz de dependências quando necessário;
   - `docs/platform/continuous-integration.md` e a spec de CI se o fluxo
     operacional mudar.
9. Executar primeiro o teste direcionado para diagnóstico e depois o comando
   agregado da categoria. O teste direcionado nunca substitui a suíte completa.
10. Verificar que a CI descobre o arquivo pelo padrão oficial e que nenhum teste
    depende de ordem, `.env` local, dado de produção ou API externa real.

## Regras da categoria

### E2E

- Executar por `npm run test:e2e`.
- Manter o job `Unit and E2E tests` sem Docker enquanto essa for a arquitetura
  documentada.
- Documentar mocks e limites para não apresentar teste de contrato como fluxo
  integral.

### Integração

- Nomear como `api/test/<nome>.integration-spec.ts`.
- Executar todas as suítes por `npm run test:integration`.
- Permitir filtro por arquivo somente para desenvolvimento e diagnóstico local.
- Provisionar serviços descartáveis com Testcontainers e portas efêmeras.
- Fechar clientes, processos, redes e containers mesmo após falha.
- Nunca acessar produção, Brevo ou outro provider externo real.

## Contrato documental

Criar uma página por suíte usando
`docs/tests/reference/suite-documentation-template.md`. Registrar:

- caminho, objetivo e limites;
- comportamentos comprovados;
- componentes reais e mocks;
- dependências, versões e provisionamento;
- Docker, rede, credenciais e portas;
- isolamento e cleanup;
- comandos local e de CI;
- falhas de ambiente e gatilhos de manutenção.

Ao renomear ou remover um teste, renomear ou remover sua página e atualizar os
índices. Não deixar documentação descrevendo uma suíte inexistente.

## Condições de parada

Parar e atualizar a spec antes de prosseguir quando:

- surgir dependência não provisionada localmente ou no job;
- for necessário mudar a pipeline;
- a nova suíte ultrapassar ou ameaçar o timeout;
- o desenho exigir estado compartilhado ou ordem entre arquivos;
- o teste precisar de credencial ou acesso externo real;
- a classificação E2E/integração divergir da documentação atual.

