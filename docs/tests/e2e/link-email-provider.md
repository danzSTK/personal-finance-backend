# `link-email-provider.e2e-spec.ts`

## Classificação e objetivo

- Arquivo: `api/test/link-email-provider.e2e-spec.ts`
- Categoria: E2E
- Objetivo: comprovar o contrato HTTP de vínculo do provider `EMAIL`, incluindo
  request novo, compatibilidade do campo legado, validação e erros da plataforma.
- Fora de escopo: persistência PostgreSQL, bcrypt, login real e concorrência.

## Comportamentos comprovados

- Aceita somente `password` e retorna response DTO identificado.
- Aceita `email` depreciado, mas não o repassa ao caso de uso.
- Rejeita propriedades desconhecidas e senha acima de 72 bytes UTF-8.
- Traduz provider já vinculado para `409 AUTH_PROVIDER_ALREADY_LINKED`.

## Composição

- Componentes reais: controller, decorators, DTO, `ValidationPipe` e filtro global.
- Componentes mockados: casos de uso e serviços injetados pelo controller.

## Dependências de execução

| Dependência | Versão | Provisionamento   | Obrigatória |
| ----------- | ------ | ----------------- | ----------- |
| Node.js     | 24     | ambiente local/CI | sim         |

- Docker: não.
- Rede externa: não.
- Credenciais reais: não.
- Portas: servidor NestJS efêmero do Supertest.

## Isolamento e cleanup

Cada teste cria uma aplicação NestJS e usa usuário sintético. `afterEach` fecha a
aplicação; nenhum dado persistente é criado.

## Execução

```bash
# Diagnóstico direcionado
npx jest --config ./test/jest-e2e.json --runInBand link-email-provider.e2e-spec.ts

# Validação agregada obrigatória
npm run test:e2e -- --runInBand
```

- Job de CI: `Unit and E2E tests`.
- Falhas de ambiente conhecidas: nenhuma dependência externa.

## Quando atualizar

Atualizar esta página quando mudarem request, response, validação, erros, mocks ou
dependências do endpoint.
