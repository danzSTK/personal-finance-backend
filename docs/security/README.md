---
area: security
type: reference
status: current
last_reviewed: 2026-11-24
related:
  - ../architecture.md
  - ../architecture/module-boundaries.md
  - ../auth/README.md
  - ../auth/concepts/csrf-origin-check.md
  - ../errors/README.md
  - ../database/schema.md
  - ../../SECURITY.md
---

# Baseline de Segurança e Modelo de Ameaças (Danfy Backend)

Este documento define os controles técnicos de segurança vigentes no backend da Danfy e serve como fonte autoritativa para implementação e revisão de segurança de novas features e pull requests.

Para divulgação responsável de vulnerabilidades externas, consulte a [Política de Segurança](../../SECURITY.md).

---

## 1. Superfície de Ataque e Princípios

A Danfy é uma API financeira pessoal multi-tenant separada em dois papéis de processo (`PROCESS_ROLE=api` e `PROCESS_ROLE=worker`), utilizando PostgreSQL 16, dois ambientes Redis (cache/sessões e BullMQ com `noeviction`) e Cloudflare R2.

Princípios obrigatórios:

1. **Deny-by-default na borda HTTP:** toda rota é protegida pela cadeia global de guards; exceções precisam ser explícitas e justificadas.
2. **Isolamento multi-tenant no acesso a dados:** nenhum recurso pertencente a um usuário pode ser lido, vinculado ou mutado por outro usuário, direta ou indiretamente.
3. **Defesa em profundidade:** regras críticas de integridade e isolamento existem na borda HTTP, no domínio/aplicação e em constraints do PostgreSQL.
4. **Higiene de segredos e dados sensíveis:** credenciais, tokens, secrets e PII desnecessária nunca aparecem em respostas HTTP, logs, payloads da Transactional Outbox ou jobs BullMQ.

---

## 2. Cadeia Global de Guards e Política de Bypasses

Em `api/src/app/api/api.module.ts`, quatro `APP_GUARD`s são executados globalmente nesta ordem:

1. **`OriginGuard`**: bloqueia requisições mutáveis (`POST`, `PUT`, `PATCH`, `DELETE`) provenientes de origens fora de `CSRF_ALLOWED_ORIGINS`.
2. **`JwtAuthGuard`**: exige access token válido em cookie `HttpOnly` e popula o usuário autenticado.
3. **`EmailVerificationStatusGuard`**: bloqueia usuários em estado `PENDING_EMAIL_VERIFICATION` em rotas protegidas.
4. **`ThrottlerGuard`**: aplica rate limiting distribuído com storage Redis (`ThrottlerStorageRedisService`).

### Decorators de bypass (exigem revisão rigorosa)

Todo novo uso dos decorators abaixo abre a superfície de ataque e deve ser auditado explicitamente em code review:

| Decorator | Efeito | Quando é aceitável |
| --- | --- | --- |
| `@Public()` | Pula `JwtAuthGuard` e `EmailVerificationStatusGuard` | Fluxos explicitamente públicos (health checks, login, cadastro, verificação/OAuth callbacks) com validação própria de segurança e rate limit adequado. |
| `@SkipOriginCheck()` | Pula `OriginGuard` | Apenas callbacks/rotas onde o navegador legitimamente envia origem externa (ex.: OAuth callback) e que possuam proteção própria contra CSRF (ex.: `state` stateful no Redis). |
| `@AllowPendingEmailVerification()` | Permite acesso com e-mail ainda não verificado | Apenas rotas estritamente necessárias ao fluxo de verificação/sessão/logout do próprio usuário pendente. |
| `@SkipThrottle()` | Remove rate limiting | Apenas rotas comprovadamente seguras e justificadas (ex.: probes internos controlados), nunca em endpoints de autenticação, escrita ou alto custo. |

---

## 3. Autenticação, Sessões e CSRF

- **Cookies de sessão:** access token e refresh token trafegam em cookies `HttpOnly`, com `secure`, `sameSite` e `path` definidos em `AUTH_CONSTANTS`. Tokens nunca devem ser retornados no corpo de endpoints comuns de login ou logados.
- **Rotação e revogação:** refresh tokens rotacionam a cada uso; sessões são rastreadas no Redis; logout e troca de senha invalidam tokens via blacklist/sessões e incremento de `users.credential_version`.
- **Senhas locais:** validadas contra o limite UTF-8 de 72 bytes do bcrypt (`@IsPasswordWithinUtf8ByteLimit()`) para evitar truncamento silencioso. Consulte `docs/auth/concepts/local-password-policy.md`.
- **OAuth linking:** fluxos de vinculação de provedor nunca fazem auto-link silencioso e utilizam `state` efêmero armazenado no Redis (`CacheKeys.auth.googleLinkState`).
- **Proteção CSRF (`OriginGuard`):** `OriginGuard` permite requisições sem cabeçalhos `Origin` e `Referer` por compatibilidade com clientes não-navegador/CLI. Por isso, a proteção contra CSRF em navegadores depende da combinação de `OriginGuard` + política `SameSite` dos cookies + proibição de mutações via métodos seguros (`GET`/`HEAD`/`OPTIONS`).

---

## 4. Autorização Multi-Tenant (BOLA / IDOR)

- **Identidade confiável:** o `userId` sempre vem do principal autenticado via `@CurrentUser()`, nunca de `req.body`, `req.query` ou `req.params`.
- **IDOR direto:** leituras, atualizações, arquivamentos e deleções por ID devem filtrar por `(id, userId)` no repositório/query — nunca buscar apenas por `id` e checar depois de expor ou mutar.
- **IDOR indireto (relacionamentos):** toda operação que referencia IDs de outros recursos (`accountId`, `destinationAccountId`, `categoryId`, `assetId`, `templateId` customizado) deve verificar ownership de **todos** os recursos referenciados dentro do escopo/transação da operação. Chaves estrangeiras simples no PostgreSQL garantem existência da linha, mas **não** garantem que os registros pertencem ao mesmo `userId`.
- **Recursos globais vs privados:** recursos de catálogo institucional (ex.: `account_templates` com `template_type = 'INSTITUTIONAL'` ou categorias de sistema) nunca podem ser editados ou removidos por usuários comuns.

---

## 5. Validação de Entrada e Exposição de Saída (BOPLA / Mass Assignment)

- **Pipe global:** `main.ts` configura `ValidationPipe` com `whitelist: true`, `forbidNonWhitelisted: true` e `transform: true` com `enableImplicitConversion: true`.
- **Riscos que o pipe global NÃO elimina sozinho:**
  - campos de controle expostos indevidamente no Request DTO (ex.: `userId`, `status`, `isSystem`, `templateType`, `effectiveAt` arbitrário);
  - objetos aninhados sem `@ValidateNested()` e `@Type()`, ou propriedades tipadas como `any`/`Record<string, unknown>`;
  - coerções inesperadas causadas por `enableImplicitConversion: true` (ex.: strings convertidas para boolean/number sem decorator específico como `@ParseBooleanQueryParam()` ou validação explícita de inteiro seguro);
  - limites ausentes em coleções (`@ArrayMaxSize()`), strings (`@MaxLength()` usando constantes de `@/common/models/constants`) e parâmetros de paginação.
- **Saída segura:** controllers sempre retornam Response DTOs explícitos (nunca entidades ORM nem entidades de domínio cruas). Campos sensíveis (`passwordHash`, `refreshTokenHash`, tokens internos) têm `{ select: false }` no ORM e nunca aparecem em DTOs de resposta.

---

## 6. Proteção Contra Abuso de Recursos

- **Rate limiting distribuído:** `ThrottlerGuard` usa Redis; fluxos críticos de credenciais (login, cadastro, reenvio de e-mail, alteração de senha) devem manter limites dedicados (ex.: `@Throttle()`, `PasswordChangeCostGuard`, scripts Lua atômicos).
- **Paginação e consultas:** endpoints de listagem e comandos de lote precisam impor limite máximo por página/batch e evitar varreduras ilimitadas.
- **Custo criptográfico e de mídia:** respeitar limites de tamanho de senha (UTF-8 bytes) e limites de tamanho/dimensão no processamento de arquivos com `sharp`.

---

## 7. Uploads, Assets e Object Storage (Cloudflare R2)

- **Fronteira de módulo:** somente `api/src/modules/assets/` pode interagir com `IObjectStorage` / SDK S3 / Cloudflare R2.
- **Validação de conteúdo:** nunca confiar apenas em `Content-Type` HTTP ou extensão do nome do arquivo; validar assinatura real do arquivo (`file-type` / magic bytes) e reprocessar/sanitizar imagens via `sharp` quando aplicável.
- **Chaves de storage:** gerar `storage_key` no servidor de forma controlada, rejeitando path traversal (`..`, prefixo `/`) e garantindo a constraint no banco (`CHK_*_storage_key`).
- **Ciclo de vida e limpeza:** módulos consumidores apenas vinculam `asset_id` e marcam `DELETE_PENDING` na mesma transação; a exclusão física ocorre assincronamente no worker (`AssetReconcilerService`).

---

## 8. Injeção, Templates e Processamento Assíncrono

- **SQL:** usar exclusivamente queries parametrizadas (TypeORM repository/QueryBuilder com parâmetros ligados). Nunca interpolar entrada externa em SQL bruto, cláusulas `ORDER BY`, nomes de coluna ou filtros dinâmicos (usar allowlist fechada).
- **Redis / Scripts Lua:** passar chaves via `KEYS` e argumentos via `ARGV` (nunca concatenar input no script) e respeitar hash tags (`{userId}`) quando exigido pelo contrato de cluster.
- **Templates de e-mail:** validar via `npm run email-templates:validate`; nunca injetar HTML não escapado de entrada do usuário em placeholders de e-mail.
- **Transactional Outbox e BullMQ:** payloads persistidos em `outbox_messages`, `email_messages` ou jobs BullMQ **nunca** devem carregar senhas, tokens em claro, cookies ou secrets.
- **Erros e Logs:** `AppExceptionFilter` traduz `DomainError`/`ApplicationError` para códigos estáveis sem expor stack traces, SQL bruto, nomes de constraints internas ou segredos. Logs estruturados devem omitir senhas, tokens, cabeçalhos `Cookie`/`Authorization` e PII desnecessária.

---

## 9. Superfície HTTP, Processos e Supply Chain

- **Headers e CORS:** manter `helmet()` ativo (`hsts: isProduction`) e CORS restrito a `FRONTEND_URL` em produção (nunca `origin: true` ou `*` com `credentials: true` em produção).
- **Documentação Swagger (`/docs`):** avaliar explicitamente exposição de metadados internos ou endpoints sensíveis no Swagger e manter contratos documentados alinhados ao comportamento real.
- **Separação de processos (`API` vs `Worker`):**
  - o worker não expõe porta HTTP pública;
  - cada processo recebe apenas os secrets mínimos necessários (validados no boot via schema de configuração);
  - variáveis de ambiente são lidas via `ConfigService` / módulos de `api/src/config/`, nunca via `process.env` espalhado pelo código de domínio/aplicação.
- **Containers e Dependências:** containers executam como usuário não-root; toda alteração em `package.json`, `package-lock.json`, Dockerfiles, `.github/workflows/` ou `.trivyignore` exige revisão de necessidade, permissões mínimas (`permissions:`) e justificativa de exceções de scanner.
