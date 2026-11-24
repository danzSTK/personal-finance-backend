# Seguranca: Guards Globais, Autenticacao, Multi-Tenancy (BOLA/IDOR) e CSRF

Referencia do `security-review` baseada em `docs/security/README.md` e `api/src/app/api/api.module.ts`.

---

## 1. Cadeia Global de Guards e Auditoria de Bypasses

Ordem global em `ApiModule`: `OriginGuard` -> `JwtAuthGuard` -> `EmailVerificationStatusGuard` -> `ThrottlerGuard`.

- [ ] **`@Public()`:** o endpoint realmente precisa ser publico? Se for autenticacao/verificacao/callback, possui rate limit rigoroso, prevencao de enumeracao de contas/e-mails e validacao forte de token/state?
- [ ] **`@SkipOriginCheck()`:** so e aceitavel quando o navegador precisa chegar de origem externa (ex.: OAuth callback) **e** existe protecao anti-CSRF equivalente (`state` stateful no Redis com uso unico e TTL curto). Nunca aceitar em endpoints de mutacao comum.
- [ ] **`@AllowPendingEmailVerification()`:** restrito estritamente ao ciclo de verificacao de e-mail, consulta da propria sessao ou logout. Nunca liberar operacoes financeiras (`accounts`, `categories`, `transactions`, `assets`) para usuarios com e-mail pendente.
- [ ] **`@SkipThrottle()`:** nunca aceitavel em rotas de auth, escrita, busca custosa ou envio de notificacoes.

---

## 2. BOLA / IDOR Direto e Indireto (OWASP API1)

- [ ] **Origem do `userId`:** todo endpoint protegido extrai o usuario via `@CurrentUser()`. Nunca aceitar `userId`, `ownerId` ou `ownerUserId` vindos de `body`, `query` ou `params`.
- [ ] **IDOR direto:** consultas (`findById`), atualizacoes, arquivamentos e delecoes incluem `userId` no predicado de banco/repositorio — nunca buscar por `id` sozinho e validar depois de expor dados ou mutar estado.
- [ ] **IDOR indireto (vinculos cruzados):** ao criar ou atualizar uma entidade que referencia outros IDs:
  - `transactions`: validar ownership de `accountId`, `destinationAccountId` (em `TRANSFER`), `categoryId` e eventuais `assetId` de anexos;
  - `accounts`: validar ownership de `templateId` quando `CUSTOM`, e validar existencia/atividade quando `INSTITUTIONAL`;
  - `users`: validar ownership e finalidade (`purpose`) do `avatarAssetId`;
  - novas features: verificar **toda** FK/ID fornecido pelo cliente contra o `userId` autenticado dentro da mesma transacao/lock.
- [ ] **Recursos globais/institucionais vs privados:** usuarios comuns nunca podem editar, arquivar ou excluir categorias de sistema ou templates institucionais (`template_type = 'INSTITUTIONAL'`).
- [ ] **Mensagens e status consistentes:** evitar vazar existencia de recursos de outro usuario quando o contrato esperado e `404 Not Found` (nao distinguir "nao existe" de "pertence a outro usuario" sem motivo documentado).

---

## 3. Autenticacao, Sessoes, Cookies e OAuth (OWASP API2)

- [ ] **Cookies HttpOnly:** tokens trafegam apenas em cookies configurados via `AUTH_CONSTANTS` (`httpOnly: true`, `secure`, `sameSite`, `path`). Nunca retornar access/refresh token no JSON de resposta nem aceitar JWT em query string.
- [ ] **Revogacao e `credential_version`:** mudancas de senha ou revogacao de sessao invalidam refresh tokens no Redis, adicionam access token a blacklist ou incrementam `users.credential_version` de forma consistente.
- [ ] **Rotacao de refresh token:** reutilizacao de refresh token ja rotacionado ou revogado deve falhar com seguranca e nunca emitir nova sessao valida.
- [ ] **OAuth linking:** sem auto-link silencioso por e-mail; `state` gerado com entropia criptografica (`crypto.randomBytes`), armazenado no Redis, vinculado ao usuario correto e consumido uma unica vez.
- [ ] **Open Redirect em callbacks:** qualquer redirecionamento pos-OAuth ou pos-verificacao deve usar base confiavel de `ConfigService` (`FRONTEND_URL`), nunca redirecionar para URL arbitraria vinda de query/body.

---

## 4. CSRF, Metodos Seguros e Superficie HTTP (OWASP API8)

- [ ] **Sem mutacao em `GET`/`HEAD`/`OPTIONS`:** `OriginGuard` libera metodos seguros. Qualquer mudanca de estado em `GET` abre CSRF trivial.
- [ ] **Coerencia com `OriginGuard`:** verificar que novas rotas mutaveis nao dependem de desabilitar `OriginGuard` nem quebram a verificacao de `CSRF_ALLOWED_ORIGINS`.
- [ ] **CORS e Helmet:** nunca introduzir `origin: '*'` ou `origin: true` em producao com `credentials: true`; manter `helmet()` ativo.
