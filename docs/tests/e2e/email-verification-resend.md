# `email-verification-resend.e2e-spec.ts`

## Classificação e objetivo

- Arquivo: `api/test/email-verification-resend.e2e-spec.ts`
- Categoria: E2E de contrato HTTP.
- Objetivo: validar resend/status, DTOs dinâmicos, filtro, status HTTP e headers.
- Fora de escopo: PostgreSQL, Redis, BullMQ, JWT criptográfico e provider reais.

## Comportamentos comprovados

- status disponível retorna contadores, `retryAfterSeconds: null`,
  `Cache-Control: no-store` e não retorna o header `Retry-After`;
- status bloqueado retorna causa operacional, contador e header sincronizado;
- status já verificado retorna a forma terminal com `retryAfterSeconds: null` e
  sem o header `Retry-After`;
- resend aceito retorna `202` e DTO próprio;
- bloqueio do resend retorna `429`, código estável, detalhes e `Retry-After`.

## Composição e dependências

Usa `AuthController`, `AppExceptionFilter` e Supertest reais. Um middleware anexa
usuário sintético pendente; os casos de uso são mocks. Não usa Docker, rede,
credencial ou serviço externo.

## Isolamento e execução

Aplicação e mocks são recriados por teste e fechados em `afterEach`.

```bash
npm run test:e2e -- --runTestsByPath test/email-verification-resend.e2e-spec.ts
npm run test:e2e
```

Job de CI: `Unit and E2E tests`.

## Quando atualizar

Atualizar quando rota, autenticação, forma dos DTOs, status, headers, filtro ou
códigos públicos mudarem.
