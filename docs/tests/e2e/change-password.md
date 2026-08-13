# `change-password.e2e-spec.ts`

## Classificação e objetivo

- Arquivo: `api/test/change-password.e2e-spec.ts`
- Categoria: E2E de contrato HTTP.
- Objetivo: validar rota, DTO, pipes, filtro global, cookies e `Retry-After`.
- Fora de escopo: bcrypt, repositories, PostgreSQL, Redis, outbox e worker reais.

## Comportamentos comprovados

- sucesso retorna `auth.password_change` e expira os dois cookies;
- bloqueio retorna `429`, código de plataforma, detalhes e `Retry-After`;
- campos inválidos ou desconhecidos são rejeitados antes do caso de uso.

## Composição e dependências

Usa `AuthController`, ValidationPipe, filtro e Supertest reais. O usuário e o token
são anexados por middleware de teste. `ChangeUserPasswordUseCase` é mockado e
`PasswordChangeCostGuard` é substituído. Não usa Docker, rede ou credenciais reais.

## Isolamento e execução

A aplicação e os mocks são recriados por teste e fechados em `afterEach`.

```bash
npm run test:e2e -- --runTestsByPath test/change-password.e2e-spec.ts
npm run test:e2e
```

Job de CI: `Unit and E2E tests`.

## Quando atualizar

Atualizar quando rota, DTO, resposta, cookies, erros, headers, guard ou mocks
mudarem. O fluxo real está documentado na suíte de integração
`password-change-flow`.

