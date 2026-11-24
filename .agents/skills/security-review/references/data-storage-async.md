# Seguranca: BOPLA, Uploads/R2, Injeccao e Higiene de Dados/Assincronismo

Referencia do `security-review` para entrada/saida, storage, sinks de injeccao, logs e mensageria.

---

## 1. BOPLA, Mass Assignment e Exposicao de Dados (OWASP API3)

`main.ts` usa `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } })`. Mesmo assim, audite:

- [ ] **Campos privilegiados no Request DTO:** o DTO aceita apenas campos que o cliente tem permissao para definir? Sinalize se o DTO expuser campos controlados pelo sistema (`userId`, `status`, `isSystem`, `templateType`, `credentialVersion`, `deletedAt`, `storageKey`, `effectiveAt` indevido).
- [ ] **Objetos aninhados e tipos abertos:** toda propriedade de objeto/array aninhado precisa de `@ValidateNested()` + `@Type(() => NestedDto)` (sem isso, `whitelist` nao valida o interior). Rejeite `any` ou `Record<string, unknown>` sem validacao explicita.
- [ ] **Armadilhas de `enableImplicitConversion: true`:**
  - `boolean` em query params pode converter `"false"` para `true` se nao usar decorator dedicado (`@ParseBooleanQueryParam()`);
  - campos monetarios (`amountCents`, `initialBalanceCents`) devem validar inteiro seguro (`@IsInt()`, `Number.isSafeInteger()`) e limites de dominio, rejeitando `NaN`, `Infinity` ou floats;
  - `DateOnly` deve validar formato estrito `YYYY-MM-DD` (`@IsDateOnly()`), nunca aceitar `Date` convertido automaticamente.
- [ ] **Limites de tamanho:** strings possuem `@MaxLength()` (usando constantes de `@/common/models/constants`); arrays possuem `@ArrayMaxSize()`.
- [ ] **Saida segura:** controller retorna Response DTO explicito (nunca ORM entity nem Domain entity). Campos sensiveis no ORM (`passwordHash`, `refreshTokenHash`, segredos/hashes internos) declaram `{ select: false }` e nunca aparecem em Response DTOs.

---

## 2. Uploads, Assets e Cloudflare R2

- [ ] **Fronteira de modulo:** nenhum modulo fora de `api/src/modules/assets/` importa `IObjectStorage`, `@aws-sdk/client-s3` ou manipula buckets/chaves R2 diretamente.
- [ ] **Validacao de conteudo real:** nao confiar apenas em `file.mimetype` ou extensao do nome do arquivo; validar assinatura real via `file-type` (magic bytes) e impor limite de tamanho em bytes.
- [ ] **Processamento seguro de imagem (`sharp`):** validar dimensoes maximas / re-encodar para remover metadados perigosos (EXIF/polyglots) e evitar decompression bombs.
- [ ] **Geracao de `storage_key`:** gerada exclusivamente no servidor, sem nome de arquivo bruto do cliente, sem `..`, sem barra inicial (`/`), respeitando a constraint `CHK_*_storage_key`.
- [ ] **Escopo publico vs privado:** confirmar se o arquivo pertence ao bucket publico ou privado (`R2_PUBLIC_BUCKET_NAME` vs `R2_PRIVATE_BUCKET_NAME`) — comprovantes/documentos privados de usuario nunca devem ir para bucket publico.
- [ ] **Desalocacao segura:** exclusoes de entidades consumidoras marcam o asset como `DELETE_PENDING` na transacao local e deixam a remocao fisica para `AssetReconcilerService`.

---

## 3. Rastreamento de Sinks de Injeccao

Trace toda entrada externa (`body`, `query`, `params`, headers, nome de arquivo, metadados OAuth) ate qualquer sink:

- [ ] **SQL:** zero interpolacao em `queryRunner.query()`, `manager.query()`, `.where()`, `.andWhere()` ou `.orderBy()`. Sempre parametros ligados + allowlist para identificadores/ordenacao.
- [ ] **Redis / Scripts Lua:** zero concatenacao de input dentro do corpo Lua; todas as chaves via `KEYS` e valores via `ARGV`.
- [ ] **Templates de e-mail (`api/email-templates/`):** validar com `npm run email-templates:validate`; nunca injetar HTML arbitrario ou URLs nao validadas controladas pelo usuario nos placeholders do template.
- [ ] **SSRF / URLs externas:** se alguma nova feature realizar chamadas HTTP de saida usando dados fornecidos pelo cliente, validar protocolo (`https`), allowlist de hosts e bloqueio de IPs privados/loopback/metadata (`127.0.0.1`, `169.254.169.254`, RFC1918).

---

## 4. Erros, Logs e Payloads Assincronos (Outbox / BullMQ)

- [ ] **Erros padronizados:** erros lancados passam pelo `AppExceptionFilter` sem expor stack traces, SQL bruto, nomes de tabelas/constraints internas, credenciais ou dados de terceiros.
- [ ] **Transactional Outbox (`outbox_messages`) e filas BullMQ:** payloads persistidos/enfileirados **nunca** podem conter senhas, hashes de senha, access/refresh tokens, cookies, chaves secretas ou links/tokens em claro quando nao estritamente previstos e protegidos por design aprovado.
- [ ] **Logs:** nunca logar `req.headers.cookie`, `req.headers.authorization`, senhas, tokens, secrets de configuracao ou dados financeiros/PII completos do usuario.
