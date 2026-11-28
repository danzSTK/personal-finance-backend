# `fiscal-notes.e2e-spec.ts`

## Classificação e objetivo

- Arquivo: `api/test/fiscal-notes.e2e-spec.ts`
- Categoria: E2E HTTP isolado.
- Objetivo: validar o contrato HTTP de `FiscalNotesController`, `TransactionFiscalNoteController` e `TransactionsController`, guarda de autenticação (`TestSessionGuard`), validação de DTOs de corpo/query/parâmetros, status codes, `object` discriminators (`fiscal_note.list`, `fiscal_note.summary`, `fiscal_note.summary_totals`, `fiscal_note.preview`, `fiscal_note.import`, `fiscal_note.item`), `details` estruturados em `409`, header `Retry-After` em `429`/`503`, `hasFiscalNote` em `TransactionResponseDto` e isolamento de `/health/liveness`.
- Fora de escopo: PostgreSQL real, Redis real, chamadas externas à SEFAZ-CE, `OriginGuard`/`EmailVerificationStatusGuard`/`ThrottlerGuard` reais e validação criptográfica de JWT.

## Comportamentos comprovados

- requisições sem sessão válida são rejeitadas com `401 UNAUTHORIZED` antes de invocar os use cases (incluindo `GET /fiscal-notes` e `GET /fiscal-notes/:id`);
- `GET /fiscal-notes` retorna `200 OK` com `object: 'fiscal_note.list'`, `data` (`fiscal_note.summary` sem `items[]`/`payments[]`), `meta` de paginação e `summary` (`fiscal_note.summary_totals`), repassando filtros (`issuedFrom`/`issuedTo`, `issuerCnpj`, `sourceUf`, `minAmountCents`/`maxAmountCents`, `search`), ordenação (`sort`) e paginação (`page`/`limit`), além de rejeitar faixas inválidas com `400 FISCAL_NOTE_INVALID_INPUT` e parâmetros de query inválidos com `400 VALIDATION_ERROR`;
- `GET /fiscal-notes/:id` retorna `200 OK` com `object: 'fiscal_note.item'`, rejeita UUID inválido com `400 VALIDATION_ERROR` e retorna `404 FISCAL_NOTE_NOT_FOUND` quando inexistente, deletada ou inacessível;
- `POST /fiscal-notes/preview` retorna `200 OK` com `object: 'fiscal_note.preview'`, `alreadyImported`, `cacheHit` e `suggestedTransaction`;
- `POST /fiscal-notes/import` retorna `201 Created` com `object: 'fiscal_note.import'`, `transaction.hasFiscalNote: true` e `fiscalNote` (`object: 'fiscal_note.item'`);
- `POST /transactions/:id/fiscal-note`, `GET /transactions/:id/fiscal-note` e `DELETE /transactions/:id/fiscal-note` respeitam `201`, `200` (`fiscal_note.item`) e `204`;
- `GET /transactions`, `GET /transactions/:id`, `PATCH /transactions/:id` e `PATCH /transactions/:id/confirm` refletem `hasFiscalNote` e retornam `409 TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE` ao tentar alterar o tipo com nota ativa;
- validação de DTO rejeita `input` vazio ou `> 1024` caracteres e UUIDs inválidos com `400 VALIDATION_ERROR`;
- conflitos `409 FISCAL_NOTE_ALREADY_IMPORTED` e `409 TRANSACTION_ALREADY_HAS_FISCAL_NOTE` expõem `details` estruturado via `AppExceptionFilter`;
- `429 FISCAL_NOTE_RATE_LIMIT_EXCEEDED` e `503 SEFAZ_TEMPORARILY_UNAVAILABLE` propagam o header HTTP `Retry-After`;
- `GET /health/liveness` responde `200` isolado da disponibilidade da SEFAZ e sem dependência externa.

## Composição

- Componentes reais: aplicação NestJS com `FiscalNotesController`, `TransactionFiscalNoteController`, `TransactionsController`, `HealthController`, `ValidationPipe` global (`createValidationException`), `AppExceptionFilter` e Supertest.
- Componentes mockados: todos os use cases de `fiscal-notes` e `transactions`, `HealthCheckService`, indicadores de health (`TypeOrmHealthIndicator`, `MemoryHealthIndicator`, `RedisHealthIndicator`) e `TestSessionGuard` como `APP_GUARD` sintético.

## Dependências de execução

| Dependência | Versão | Provisionamento | Obrigatória |
| ----------- | ------ | --------------- | ----------- |
| Nenhuma     | —      | processo Jest   | —           |

- Docker: não utiliza.
- Rede externa: nenhuma.
- Credenciais reais: nenhuma.
- Portas: nenhuma porta fixa; usa servidor HTTP efêmero via Supertest.

## Isolamento e cleanup

Usa dados sintéticos em memória, restaura estado de ambiente e mocks com `jest.clearAllMocks()` em `beforeEach`, e encerra `app.close()` em `afterAll`.

## Execução

```bash
# Diagnóstico direcionado
npm run test:e2e -- fiscal-notes.e2e-spec.ts

# Validação agregada obrigatória
npm run test:e2e
```

- Job de CI: `Unit and E2E tests`.
- Falhas de ambiente conhecidas: nenhuma dependência externa além de Node.js/Jest.

## Quando atualizar

Atualizar esta página quando mudarem rotas, DTOs de entrada/saída, discriminadores `object`, códigos de erro ou `details`/`Retry-After` no `AppExceptionFilter`.
