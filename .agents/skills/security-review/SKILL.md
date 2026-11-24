---
name: security-review
description: Revisao dedicada de seguranca da aplicacao para novas features, endpoints, mudancas de autenticacao/autorizacao, multi-tenancy (IDOR/BOLA), DTOs, uploads/R2, filas/outbox, configuracao ou dependencias no backend Danfy. Use sempre que o usuario pedir security review, auditoria de seguranca ou revisao de riscos de seguranca em um PR ou feature.
---

# Security Review

Auditoria de seguranca orientada a ameacas reais do backend Danfy (NestJS 11, PostgreSQL 16, Redis, BullMQ, Cloudflare R2), compativel com Codex e Claude Code.

## Fontes Obrigatorias Antes de Revisar

1. `docs/security/README.md` — baseline tecnico de seguranca e modelo de ameacas da Danfy;
2. `AGENTS.md` (secoes `Security` e `## Code Review Rules`) e `api/src/modules/<modulo>/AGENTS.md` dos modulos tocados;
3. `api/src/app/api/api.module.ts` e `api/src/main.ts` quando o diff tocar guards, pipes, CORS, Helmet, cookies ou bootstrap;
4. `docs/auth/` quando o diff tocar login, sessoes, tokens, OAuth, troca de senha ou verificacao de e-mail;
5. a spec da feature em `docs/specs/` para confirmar requisitos e limites de seguranca acordados.

## Fluxo de Auditoria de Seguranca

Mapeie a superficie de ataque tocada pelo diff e aplique os modulos correspondentes:

### 1. Identidade, Guards Globais, Multi-Tenancy e CSRF
Leia `references/auth-tenant-csrf.md` sempre que o diff tocar controllers, guards, decorators, autenticacao, sessoes, OAuth ou acesso a recursos de usuario:
- audite **todo** uso novo ou alterado de `@Public()`, `@SkipOriginCheck()`, `@AllowPendingEmailVerification()` e `@SkipThrottle()`;
- rastreie fluxos de **BOLA / IDOR direto e indireto** (`userId` deve vir de `@CurrentUser()`, e todo recurso referenciado como `accountId`, `destinationAccountId`, `categoryId`, `assetId` ou `templateId` customizado deve validar ownership na mesma operacao/transacao);
- verifique protecao de recursos institucionais/de sistema contra mutacao por usuarios comuns;
- valide cookies `HttpOnly`/`Secure`/`SameSite`, rotacao de refresh token, `credential_version`, `state` OAuth e `OriginGuard` (CSRF).

### 2. Entrada/Saida (BOPLA), Uploads/R2, Injeccao e Higiene Assincrona
Leia `references/data-storage-async.md` sempre que o diff tocar DTOs, mappers, uploads/assets, SQL/Lua, templates de e-mail, outbox, filas BullMQ, filtros de erro ou logs:
- verifique **BOPLA / Mass Assignment** (campos controlados pelo servidor aceitos no DTO, objetos aninhados sem `@ValidateNested()`/`@Type()`, coercoes perigosas com `enableImplicitConversion: true`, exposicao de entidades ou campos `{ select: false }`);
- audite uploads e Object Storage (isolamento em `assets`, validacao de magic bytes via `file-type`, sanitizacao via `sharp`, `storage_key` gerada no servidor sem path traversal);
- trace toda entrada nao confiavel ate sinks perigosos (SQL, scripts Lua no Redis, templates HTML de e-mail, URLs/redirecionamentos);
- garanta ausencia de senhas, tokens, cookies, secrets e PII desnecessaria em respostas HTTP, logs, `outbox_messages`, `email_messages` e jobs BullMQ.

### 3. Abuso de Recursos, Configuracao, Processos e Supply Chain
Leia `references/abuse-config-supply-chain.md` sempre que o diff tocar throttling, paginacao, senhas, `api/src/config/`, `.env.exemple`, `package.json`, Dockerfiles, `.github/workflows/` ou `.trivyignore`:
- valide rate limiting, cost guards, limite UTF-8 de 72 bytes para bcrypt, limites de paginacao/arrays/upload;
- valide isolamento de secrets por `PROCESS_ROLE` (`api` vs `worker`), uso exclusivo de `ConfigService` (sem `process.env` no dominio/aplicacao), CORS/Helmet e superficie do Swagger;
- audite novas dependencias, permissoes de GitHub Actions (`permissions:`), containers nao-root e excecoes em `.trivyignore`.

### 4. Lag de Documentacao de Seguranca
Se a feature introduzir um novo fluxo de autenticacao, novo decorator de bypass, nova protecao/rate-limit ou novo limite de seguranca, verifique se `docs/security/README.md`, `docs/auth/` e `docs/configuration.md` / `.env.exemple` foram atualizados junto.

## Padrao de Cada Achado

- Responda em **portugues** (ou siga exatamente o schema JSON solicitado).
- Reporte apenas vulnerabilidades ou fraquezas com **caminho exploravel ou violacao concreta de controle de seguranca** (nao gere alertas teoricos sem alcance real).
- Para cada achado, informe:
  1. **Severidade (`P0` critico/bloqueador, `P1` alto/importante, `P2` hardening relevante)** e classe de risco (ex.: BOLA/IDOR, Auth Bypass, BOPLA, CSRF, Injection, Data Exposure, DoS, Supply Chain);
  2. **Arquivo e linha**;
  3. **Controle ou documento violado** (`docs/security/README.md`, `AGENTS.md`, OWASP API Top 10);
  4. **Cenario concreto de exploracao** (passo a passo observavel);
  5. **Correcao segura recomendada** (e teste de regressao de seguranca esperado).

## References

- `references/auth-tenant-csrf.md` — Guards globais, bypasses, BOLA/IDOR direto e indireto, sessoes/JWT/OAuth e CSRF.
- `references/data-storage-async.md` — BOPLA/mass assignment, uploads/R2, SQL/Lua/email injection, erros, logs e payloads assincronos.
- `references/abuse-config-supply-chain.md` — Rate limiting, DoS, `PROCESS_ROLE`/config, superficie HTTP e supply chain/CI.
