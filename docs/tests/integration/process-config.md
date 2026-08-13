# `process-config.integration-spec.ts`

## Objetivo e cobertura

Valida contratos de bootstrap compilados para API e worker: configurações mínimas,
separação de secrets, mappings Brevo, roles incompatíveis e BullMQ dedicado.

## Dependências

Não inicia containers nem conecta aos hosts declarados. Executa subprocessos Node
contra `dist/`, portanto depende do build realizado pelo script
`test:integration`. Todos os valores são sintéticos e providers externos ficam
desabilitados, salvo os cenários que validam apenas configuração Brevo.

## Execução

```bash
npm run test:integration -- --runTestsByPath test/process-config.integration-spec.ts
npm run test:integration
```

Atualizar ao mudar entrypoints, roles, schema de configuração, secrets ou build.

