# `api-worker-flow.integration-spec.ts`

## Objetivo e cobertura

Valida a separação dos processos API/worker e o caminho real API → outbox →
EventEmitter2 → BullMQ → provider de e-mail `noop`. Também cobre evento anterior ao
bootstrap, reconciliação concorrente sem duplicidade e inicialização simultânea dos
modos watch.

## Dependências

- PostgreSQL `16-alpine` com migrations reais;
- um Redis `7-alpine` para cache e outro para BullMQ;
- `ApiModule` e `WorkerModule` reais;
- subprocessos `npm run start:dev` e `npm run start:worker:dev` no cenário de watch;
- mail desabilitado com provider `noop`.

Testcontainers provisiona portas efêmeras. Não usa Brevo, secrets ou rede da
aplicação. Os contextos, DataSource, subprocessos e três containers são fechados no
teardown.

## Execução

```bash
npm run test:integration -- --runTestsByPath test/api-worker-flow.integration-spec.ts
npm run test:integration
```

## Quando atualizar

Atualizar ao mudar módulos de processo, outbox, fila, reconciliação, provider noop,
variáveis obrigatórias, subprocessos ou cleanup.

