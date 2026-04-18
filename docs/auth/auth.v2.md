# Módulo Auth — Regras e Fluxos Atuais

## 1. Objetivo

Este documento descreve o comportamento **atual** do módulo `auth` da API:

- autenticação por e-mail/senha e Google OAuth;
- emissão, rotação e revogação de JWTs;
- gerenciamento de sessões stateful em Redis;
- vínculo explícito de provedores de autenticação.

---

## 2. Modelo de domínio (DDD) usado no Auth

O módulo não trabalha mais com um `User` anêmico. Hoje o `User` é uma entidade de domínio real (`users/domain/entities/user.entity.ts`) com:

- encapsulamento em `props`;
- getters para leitura de estado;
- comportamento de domínio (`addAuthProvider`, `hasAuthProvider`, `getCredentialsAuthProvider`);
- uso de Value Objects (`Email`, `UserName`, `HashedPassword`);
- composição com entidades de provider (`AuthProvider`, `CredentialsAuthProvider`, `OAuthProvider`).

Ou seja: regras de vínculo de provider e invariantes não ficam soltas em controller.

---

## 3. Provedores e regra de vínculo

Provedores suportados:

- `EMAIL` (credenciais);
- `GOOGLE` (OAuth 2.0).

Regra importante no estado atual:

- **cadastro por credenciais (`POST /auth/sign-up`) não vincula conta existente automaticamente**;
- se o e-mail já existir, o fluxo retorna `409 Conflict`;
- vínculo entre provedores é feito pelas rotas dedicadas em `/auth/providers/link/*`.

---

## 4. Endpoints do módulo Auth

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/users/me` | `JwtAuthGuard` | Retorna dados do usuário autenticado |
| `POST` | `/auth/sign-up` | público | Cadastro por e-mail/senha |
| `POST` | `/auth/sign-in` | `LocalAuthGuard` | Login por e-mail/senha |
| `GET` | `/auth/google` | `GoogleAuthGuard` | Inicia login social com Google |
| `GET` | `/auth/google/callback` | `GoogleAuthGuard` | Callback OAuth Google (redireciona frontend) |
| `POST` | `/auth/refresh` | `JwtRefreshGuard` | Rotaciona tokens |
| `POST` | `/auth/logout` | `JwtAuthGuard` | Logout e invalidação da sessão atual |
| `GET` | `/auth/sessions` | `JwtAuthGuard` | Lista sessões ativas |
| `DELETE` | `/auth/sessions/:jti` | `JwtAuthGuard` | Revoga sessão específica |
| `POST` | `/auth/providers/link/email` | `JwtAuthGuard` | Vincula provider EMAIL à conta autenticada |
| `GET` | `/auth/providers/link/google` | `JwtAuthGuard + GoogleLinkInitAuthGuard` | Inicia vínculo de conta Google |
| `GET` | `/auth/providers/link/google/callback` | `GoogleLinkAuthGuard` | Callback do vínculo Google |

### Throttling aplicado

- `POST /auth/sign-up`: `limit=10`, `ttl=10min`, `blockDuration=30min`.
- `POST /auth/sign-in` e `GET /auth/google`: `limit=5`, `ttl=1min`, `blockDuration=10min`.
- `POST /auth/refresh`: `limit=5`, `ttl=60s`.

---

## 5. Fluxos principais

### 5.1 Cadastro por credenciais (`POST /auth/sign-up`)

1. Valida DTO (`RegisterDto`).
2. Gera hash da senha.
3. Verifica se já existe provider `EMAIL` para o e-mail.
4. Verifica se já existe usuário com o mesmo e-mail.
5. Verifica se `userName` já está em uso.
6. Cria `User` com status `ACTIVE` e provider `EMAIL`.
7. Gera `accessToken` + `refreshToken`.
8. Seta refresh token em cookie HttpOnly e retorna access token no body.

Se e-mail ou username já existirem, retorna `409 Conflict`.

### 5.2 Login por credenciais (`POST /auth/sign-in`)

1. `LocalAuthGuard` usa `LocalStrategy`.
2. `ValidateCredentialsUseCase` valida:
   - usuário por e-mail;
   - existência do provider `EMAIL`;
   - senha;
   - usuário não bloqueado.
3. Em caso de sucesso, `SignInUseCase` gera novo par de tokens.
4. Refresh token é enviado via cookie HttpOnly.

Falha de credenciais retorna `401 Unauthorized`.

### 5.3 Login social Google (`GET /auth/google` + callback)

1. `/auth/google` redireciona para consentimento Google.
2. Google retorna em `/auth/google/callback`.
3. `GoogleStrategy` exige e-mail no profile do Google.
4. `OAuthCallbackUseCase`:
   - se já existir provider `GOOGLE` com aquele `googleId`, retorna usuário;
   - senão, abre transação:
     - busca usuário por e-mail;
     - se existir, adiciona provider `GOOGLE`;
     - se não existir, cria novo usuário com status `PENDING_PROFILE`.
5. API gera tokens próprios da aplicação.
6. Redireciona para `${FRONTEND_URL}/auth/callback` (sem token na URL; sessão via cookies HttpOnly).

### 5.4 Vínculo de provider EMAIL (`POST /auth/providers/link/email`)

Fluxo para usuário já autenticado:

1. Recebe `email` + `password`.
2. Verifica se já existe provider `EMAIL` com aquele e-mail.
3. Carrega usuário autenticado.
4. Impede vínculo duplicado caso o usuário já tenha provider `EMAIL`.
5. Adiciona provider no domínio e persiste em transação.

### 5.5 Vínculo de provider GOOGLE (`GET /auth/providers/link/google`)

#### Início do fluxo

1. Usuário precisa estar autenticado por JWT.
2. `GoogleLinkInitAuthGuard` cria `state` (UUID).
3. Guarda `state -> userId` no Redis com TTL de 10 minutos.
4. Redireciona para OAuth Google com esse `state`.

#### Callback do vínculo

1. Google retorna em `/auth/providers/link/google/callback`.
2. `GoogleLinkStrategy` valida `state`:
   - ausente: `missing_state`;
   - inválido/expirado: `invalid_state`.
3. Executa `LinkGoogleProviderUseCase`.
4. Se houver conflito de vínculo: `google_provider_conflict`.
5. Controller redireciona para frontend:
   - sucesso: `${FRONTEND_URL}/auth/link?success=google`
   - erro: `${FRONTEND_URL}/auth/link?error=<errorCode>`

---

## 6. Tokens e sessões

### 6.1 Access token

- JWT assinado com `accessSecret`.
- Inclui `jti`, `sub`, `email`, `status`.
- Validado no `JwtStrategy`.
- Pode ser invalidado imediatamente por blacklist em Redis no logout.

### 6.2 Refresh token

- JWT assinado com `refreshSecret`.
- Guardado em cookie HttpOnly (`refreshToken`, `path=/auth`).
- Também é rastreado em Redis por `userId + jti`.

### 6.3 Persistência de sessão no Redis

Chaves usadas:

- `auth:rt:{userId}:{jti}` → metadata da sessão do refresh token.
- `auth:sessions:{userId}` → set com `jtis` ativos do usuário.
- `auth:blacklist:{jti}` → blacklist de access tokens.
- `auth:google-link:{state}` → estado temporário do fluxo de link Google.

### 6.4 Rotação de refresh (`POST /auth/refresh`)

1. `JwtRefreshGuard` valida assinatura e expiração do refresh token no cookie.
2. Confere se a sessão (`userId + jti`) existe no Redis.
3. Remove sessão antiga.
4. Gera novo par de tokens e nova sessão.

Proteção extra:

- se o `jti` do refresh não existir mais no Redis, o sistema revoga **todas as sessões** do usuário e retorna `401` (sinal de possível replay/hijacking).

### 6.5 Logout (`POST /auth/logout`)

1. Requer access token e refresh token via cookies HttpOnly.
2. Decodifica access token para obter `jti` e TTL restante.
3. Verifica refresh token (mesmo expirado) para extrair `jti`.
4. Em paralelo:
   - adiciona `jti` do access token na blacklist com TTL restante;
   - revoga sessão do refresh token em Redis.
5. Limpa cookie de refresh.

---

## 7. Sessões ativas

- `GET /auth/sessions`: retorna sessões com metadata (`browser`, `os`, `device`, `ip`, `location`, `loginAt`).
- `DELETE /auth/sessions/:jti`: revoga uma sessão específica.
- Se `:jti` não existir para o usuário, retorna `404`.

---

## 8. Segurança e decisões técnicas

- Access e refresh usam secrets distintos.
- Refresh token é stateful em Redis (permite revogação real).
- Blacklist evita uso de access token após logout.
- `state` no link Google evita vinculação indevida por callback forjado.
- Callbacks OAuth são excluídos da documentação Swagger (`@ApiExcludeEndpoint`).

---

## 9. Observações de integração com frontend

- O backend devolve `accessToken` no body em fluxos normais (`sign-up`, `sign-in`, `refresh`).
- O `refreshToken` é sempre entregue em cookie HttpOnly.
- Callback de login Google redireciona com query `accessToken`.
- Callback de link Google redireciona com `success` ou `error` na query string.
