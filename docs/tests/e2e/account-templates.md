# `account-templates.e2e-spec.ts`

## Classificação e objetivo

- Arquivo: `api/test/account-templates.e2e-spec.ts`
- Categoria: E2E HTTP isolado.
- Objetivo: validar catálogo, proteção de sessão e o contrato HTTP discriminado de account templates em `POST /accounts` e `PATCH /accounts/:id`.
- Fora de escopo: validação criptográfica do JWT, PostgreSQL, Redis e Object Storage real.

## Composição

- Reais: aplicação Nest, controller, roteamento HTTP, supertest e filtro global de erros.
- Mockados: use case, assembler de URL e guard de sessão. O guard sintético reproduz `401`; a integração real de JWT continua coberta pelas suítes de auth existentes.

## Comportamentos comprovados

- catálogo não expõe owner nem storage key;
- `POST` aceita `template.type=institutional` com `templateId` aninhado;
- `PATCH` aceita `template.type=custom` parcial;
- `templateId` na raiz é rejeitado pelo contrato novo;
- combinação de `template` com campos legados expõe o código estável de conflito.

## Dependências

Não usa serviço externo, container, porta fixa, segredo ou mudança de pipeline.

## Execução

```bash
npm run test:e2e -- account-templates.e2e-spec.ts
npm run test:e2e
```

## Quando atualizar

Atualizar quando mudarem rota, autenticação, discriminador, campos públicos ou política de exposição de owner/storage.
