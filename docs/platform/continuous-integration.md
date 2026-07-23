---
area: platform
type: operations
status: current
related:
  - ../specs/platform/backend-ci/specs/requirements.md
  - ../specs/platform/backend-ci/specs/design.md
  - ../commands.md
---

# Integração contínua

A CI do backend valida código, testes e o artefato implantável sem publicar imagens nem acessar produção. Sua fonte executável é `.github/workflows/backend-ci.yml`.

## Quando executa

O workflow roda:

- em pull requests destinados a `develop` ou `main` quando arquivos relevantes mudam;
- em pushes relevantes para `develop` ou `main`;
- manualmente por `workflow_dispatch`.

Mudanças somente em Markdown não iniciam a execução automática. Uma execução mais nova da mesma referência cancela a anterior.

Os caminhos observados incluem a API, os arquivos Compose, `.env.exemple`, `.github/dependabot.yml` e todos os workflows. Se um novo arquivo passar a influenciar build, teste ou execução, ele também deve entrar nesses filtros.

Pull requests criadas pelo Dependabot seguem a mesma pipeline. Isso cobre atualizações npm em `api/`, imagens no Dockerfile ou Compose e qualquer Action usada em `.github/workflows/*.yml`. A rotina de triagem está em [Atualizações de dependências](./dependency-updates.md).

## Fluxo

```text
pull request | push | execução manual
                    |
       +------------+------------+------------------+
       |            |            |                  |
    Quality    Unit + E2E   Integration     Container smoke
```

Os quatro jobs são independentes. Uma falha não esconde o resultado das outras categorias.

## 1. Quality

O job usa Node.js 22, instala dependências com `npm ci` e executa:

```text
format:check -> lint:check -> typecheck -> build
```

Resultado esperado: código formatado, sem erros de lint ou tipos e compilável pelo NestJS.

## 2. Unit and E2E tests

O job fornece valores fictícios para as configurações obrigatórias e mantém provedores externos desabilitados. Depois executa:

```text
test:cov -> test:e2e
```

Resultado esperado: testes unitários e contratos HTTP aprovados, com resumo de cobertura nos logs. Não existe atualmente um percentual global de cobertura que reprove o job.

## 3. Integration tests

Executa `npm run test:integration`. Testcontainers provisiona PostgreSQL, Redis e Toxiproxy reais e descartáveis no próprio runner.

Resultado esperado: cenários que dependem do comportamento real das dependências, incluindo concorrência e recuperação de falhas, aprovados sem serviços persistentes configurados no GitHub Actions.

## 4. Container smoke test

Este job verifica o mesmo tipo de artefato usado em produção:

1. valida o Compose base com o overlay exclusivo da CI;
2. valida o merge do Compose base com `docker-compose.dev.yml`;
3. constrói a imagem pelo `api/Dockerfile`;
4. inicia PostgreSQL, Redis de cache e Redis dedicado do BullMQ;
5. executa migrations pela imagem construída;
6. inicia API e worker como processos separados;
7. valida liveness e readiness da API;
8. executa o health check do worker;
9. imprime status e logs quando há falha;
10. remove containers, redes e volumes em qualquer resultado.

O projeto Compose recebe um nome único por execução e a API usa porta efêmera, evitando colisões no runner.

## Como interpretar falhas

| Job                  | Investigue primeiro                                                               |
| -------------------- | --------------------------------------------------------------------------------- |
| Quality              | formatação, regra ESLint, erro TypeScript ou compilação                           |
| Unit and E2E tests   | suite e cenário indicados pelo Jest                                               |
| Integration tests    | Docker disponível, startup dos Testcontainers e logs da dependência               |
| Container smoke test | merge do Compose, build da imagem, migrations, logs de API/worker e health checks |

Não reexecute repetidamente uma falha determinística. Reproduza o comando local, corrija a causa e envie uma nova alteração.

## Reprodução local

Os comandos equivalentes estão em [Comandos principais](../commands.md). Para validar os arquivos de desenvolvimento:

```bash
docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  config --quiet
```

A fixture e o overlay de container smoke pertencem à CI. Não os use como ambiente cotidiano.

## Segurança

- a CI possui somente permissão de leitura no repositório;
- os jobs não recebem secrets de produção;
- integrações externas usam valores fictícios ou providers inativos;
- publicação e deploy ficam em workflows separados;
- logs não devem receber conteúdo do `.env` local nem credenciais.

## Manutenção

Atualize a CI quando:

- um script chamado pelo workflow mudar em `api/package.json`;
- a versão suportada do Node.js mudar;
- o Dockerfile ou a composição dos processos mudar;
- uma nova dependência for necessária ao smoke test;
- novas variáveis obrigatórias forem adicionadas;
- novos arquivos passarem a influenciar build ou deploy.
- um novo manifest monitorado pelo Dependabot for adicionado.

Ao alterar o fluxo:

1. atualize a spec de backend CI;
2. preserve os jobs independentes quando não houver dependência real;
3. mantenha `npm ci` e o lockfile como fonte das dependências;
4. use valores fictícios para configuração e nunca adicione secrets;
5. mantenha diagnóstico em falha e cleanup com `always()`;
6. valide YAML, expressões e comandos antes do merge;
7. atualize este documento se o comportamento operacional mudar.
