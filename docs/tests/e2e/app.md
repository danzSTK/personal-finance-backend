# `app.e2e-spec.ts`

## Classificação e objetivo

- Arquivo: `api/test/app.e2e-spec.ts`
- Categoria: E2E de contrato HTTP.
- Objetivo: comprovar que `GET /` responde `200` com a mensagem pública da API.
- Fora de escopo: bootstrap do `ApiModule`, banco, cache e autenticação.

## Composição e dependências

Usa `ApiController`, `@nestjs/testing` e Supertest reais. Inicializa somente o
controller em uma aplicação NestJS local. Não usa mocks, Docker, rede externa,
credenciais ou portas fixas.

## Isolamento e execução

Uma aplicação nova é criada por teste e fechada em `afterEach`.

```bash
npm run test:e2e -- --runTestsByPath test/app.e2e-spec.ts
npm run test:e2e
```

Job de CI: `Unit and E2E tests`.

## Quando atualizar

Atualizar se a resposta raiz, o módulo inicializado ou qualquer dependência mudar.

