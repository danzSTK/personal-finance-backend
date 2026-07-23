---
area: auth
type: design
status: historical
last_reviewed: 2026-07-23
superseded_by:
  - ./auth/README.md
  - ./auth/decisions/use-http-only-cookies.md
  - ./auth/concepts/csrf-origin-check.md
  - ./integrations/auth/README.md
---

# Design Spec — Migração completa do Access Token para Cookie HttpOnly

> Documento histórico da migração já concluída. Para o comportamento vigente, use as referências indicadas em `superseded_by`.

## Objetivo
Migrar o `accessToken` do transporte via header `Authorization: Bearer` para **cookie HttpOnly**, mantendo o `refreshToken` em cookie e fechando a superfície de CSRF com validação de origem.

---

## Contexto atual
- `accessToken` é lido no `JwtStrategy` via `fromAuthHeaderAsBearerToken()`.
- `refreshToken` já é lido por cookie (`JwtRefreshStrategy`) e já é setado/limpo no `AuthController`.
- `SameSite=Lax` e `secure=true` em produção já estão no projeto.
- `logout` ainda depende de `Authorization` para extrair access token.
- Callback OAuth Google hoje redireciona com `accessToken` em query string.

---

## Escopo desta migração
1. Token de acesso passa a ser emitido e consumido via cookie HttpOnly.
2. Header Bearer fica apenas como compatibilidade temporária (fase de transição), depois removido.
3. CSRF mitigado por **guard de origem** para rotas autenticadas com mutação de estado.
4. OAuth callback deixa de expor access token na URL.
5. Swagger/docs atualizados para autenticação por cookie.

## Fora de escopo
- Refatoração de domínio (entities/use-cases) fora do que já toca autenticação.
- Mudanças amplas de frontend (apenas impacto contratual é documentado).

---

## Decisões de design

### 1) Cookies (estado final)

| Token | Nome | Path | HttpOnly | Secure (prod) | SameSite | Max-Age |
|---|---|---|---|---|---|---|
| Access | `accessToken` | `/` | `true` | `true` | `Lax` | `JWT_ACCESS_EXPIRES_IN` |
| Refresh | `refreshToken` | `/auth` | `true` | `true` | `Lax` | `JWT_REFRESH_EXPIRES_IN` |

**Nota crítica:** `accessToken` precisa de `Path=/` para cobrir endpoints protegidos fora de `/auth` (ex.: `/users/me`).

### 2) Estratégia CSRF
`SameSite=Lax` ajuda, mas **não será a única barreira**.  
Adotar `Origin/Referer Guard` nas rotas autenticadas com mutação:
- `POST /auth/logout`
- `POST /auth/providers/link/email`
- `DELETE /auth/sessions/:jti`
- (recomendado) qualquer `POST/PUT/PATCH/DELETE` autenticado futuro

Regra do guard:
1. Se método for seguro (`GET/HEAD/OPTIONS`) → permite.
2. Para métodos de mutação:
   - Validar `Origin` contra allowlist.
   - Se `Origin` ausente, validar `Referer` (prefixo permitido).
   - Se ambos ausentes ou inválidos → `403 Forbidden`.

Allowlist sugerida por env:
- `CSRF_ALLOWED_ORIGINS` (lista CSV de origins permitidas).
- Fallback para `FRONTEND_URL` quando `CSRF_ALLOWED_ORIGINS` não existir.

### 3) Compatibilidade de migração
Adicionar flag temporária:
- `AUTH_ACCEPT_BEARER=true` (fase de transição)
- `AUTH_ACCEPT_BEARER=false` (estado final cookie-only)

---

## Mudanças técnicas (arquivo a arquivo)

### A. Leitura do access token por cookie
**Arquivo:** `api/src/modules/auth/infrastructure/strategies/jwt.strategy.ts`
- Trocar extractor atual por extractor combinado:
  1. cookie `accessToken`
  2. fallback Bearer (somente quando `AUTH_ACCEPT_BEARER=true`)

### B. Tipagem de request autenticada
**Arquivo:** `api/src/common/models/interfaces/auth-request.interface.ts`
- Incluir `cookies.accessToken?: string` além do refresh.

### C. Emissão e limpeza de cookie de access token
**Arquivo:** `api/src/modules/auth/presentation/http/auth.controller.ts`
- Criar helpers:
  - `setAccessTokenCookie(res, accessToken)`
  - `clearAccessTokenCookie(res)`
- Chamar `setAccessTokenCookie` em:
  - `sign-up`
  - `sign-in`
  - `refresh`
  - `google/callback`
- Em `logout`:
  - Ler access token do cookie (com fallback header na fase de transição)
  - Limpar `accessToken` e `refreshToken`

### D. OAuth callback sem token em query
**Arquivo:** `api/src/modules/auth/presentation/http/auth.controller.ts`
- Remover `?accessToken=...` do redirect.
- Redirecionar para rota de callback do frontend apenas com status (ou sem payload sensível).

### E. Guard de origem anti-CSRF
**Novo arquivo sugerido:** `api/src/common/guards/origin.guard.ts`
- Implementar `CanActivate` com validação `Origin/Referer`.
- Aplicar com `@UseGuards(OriginGuard)` nas rotas mutáveis autenticadas por cookie.

### F. Swagger/OpenAPI
**Arquivos:**
- `api/src/main.ts`
- controllers com endpoints protegidos (`auth` e `users`)

Mudanças:
- Adicionar esquema de cookie auth (ex.: `addCookieAuth('accessToken')`).
- Substituir `@ApiBearerAuth()` por `@ApiCookieAuth('accessToken')` nos endpoints relevantes.

### G. Documentação
**Arquivos:**
- `docs/integrations/README.md`
- `docs/integrations/auth/*.md`
- `docs/auth/auth.v2.md`

Atualizar:
- remover instruções de `Authorization: Bearer` como fluxo principal.
- remover exemplos com `localStorage` para access token.
- documentar exigência de `credentials: include`.

---

## Código de referência (base para implementação)

> Blocos abaixo são referência prática para acelerar a implementação.  
> Você pode copiar e ajustar conforme necessidade de contrato/compatibilidade.

### 1) `api/src/common/models/constants/auth.constants.ts`

```ts
import { AppStatus } from '../enums';

const csrfAllowedOrigins = (process.env.CSRF_ALLOWED_ORIGINS ?? process.env.FRONTEND_URL ?? '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

export const AUTH_CONSTANTS = {
  cookies: {
    refreshTokenKey: 'refreshToken',
    accessTokenKey: 'accessToken',
    refreshTokenPath: '/auth',
    accessTokenPath: '/',
    secure: process.env.NODE_ENV === AppStatus.PRODUCTION,
    sameSite: process.env.NODE_ENV === AppStatus.PRODUCTION ? 'lax' : 'lax',
  },
  compatibility: {
    // true na migração; false no estado final cookie-only
    acceptBearer: process.env.AUTH_ACCEPT_BEARER !== 'false',
  },
  csrf: {
    allowedOrigins: csrfAllowedOrigins,
  },
  throttles: {
    signin: {
      ttl: 60000,
      limit: 5,
      blockDuration: 600000,
    },
    signup: {
      ttl: 600000,
      limit: 10,
      blockDuration: 1800000,
    },
  },
} as const;
```

### 2) `api/src/config/config.module.ts` (validação de envs novos)

```ts
validationSchema: Joi.object({
  // ... existentes
  AUTH_ACCEPT_BEARER: Joi.string().valid('true', 'false').default('true'),
  CSRF_ALLOWED_ORIGINS: Joi.string().optional(),
});
```

### 3) `api/src/common/models/interfaces/auth-request.interface.ts`

```ts
import { Request } from 'express';
import { AUTH_CONSTANTS } from '../constants';
import { User } from '../../../modules/users/domain/entities/user.entity';

export interface AuthRequest extends Request {
  user?: User;
  cookies: {
    [AUTH_CONSTANTS.cookies.refreshTokenKey]?: string;
    [AUTH_CONSTANTS.cookies.accessTokenKey]?: string;
  };
}
```

### 4) `api/src/modules/auth/infrastructure/strategies/jwt.strategy.ts`

```ts
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { type ConfigType } from '@nestjs/config';
import jwtConfig from '../../../../config/jwt.config';
import { UserStatus } from '../../../../common/models/enums/user-status.enum';
import { User } from '../../../users/domain/entities/user.entity';
import { FindUserByIdUseCase } from '../../../users/application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { ISessionRepository } from '../../domain/repositories/session.repository.interface';
import { type JwtPayloadDto } from '../../presentation/dto/jwt-payload.dto';
import { type AuthRequest } from '@/common/models/interfaces/auth-request.interface';
import { AUTH_CONSTANTS } from '@/common/models/constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly findUserByIdUseCase: FindUserByIdUseCase,
    private readonly sessionRepository: ISessionRepository,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {
    const bearerExtractor = ExtractJwt.fromAuthHeaderAsBearerToken();

    super({
      jwtFromRequest: (req: AuthRequest) => {
        const tokenFromCookie = req?.cookies?.[AUTH_CONSTANTS.cookies.accessTokenKey];

        if (typeof tokenFromCookie === 'string' && tokenFromCookie.trim() !== '') {
          return tokenFromCookie;
        }

        if (AUTH_CONSTANTS.compatibility.acceptBearer) {
          return bearerExtractor(req);
        }

        return null;
      },
      ignoreExpiration: false,
      secretOrKey: jwtConfiguration.accessSecret,
      issuer: jwtConfiguration.issuer,
    });
  }

  async validate(payload: JwtPayloadDto): Promise<User> {
    if (!payload.jti) {
      throw new UnauthorizedException('Token identifier (jti) missing');
    }

    const isBlacklisted = await this.sessionRepository.isAccessTokenBlacklisted(payload.jti);

    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.findUserByIdUseCase.execute(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Invalid token: user not found');
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new UnauthorizedException('User is blocked');
    }

    return user;
  }
}
```

### 5) Novo guard anti-CSRF `api/src/common/guards/origin.guard.ts`

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AUTH_CONSTANTS } from '../models/constants';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    if (SAFE_METHODS.has(method)) {
      return true;
    }

    const origin = this.normalizeOrigin(request.headers.origin);
    if (origin && this.isAllowedOrigin(origin)) {
      return true;
    }

    const refererOrigin = this.extractRefererOrigin(request.headers.referer);
    if (refererOrigin && this.isAllowedOrigin(refererOrigin)) {
      return true;
    }

    throw new ForbiddenException('Invalid request origin');
  }

  private isAllowedOrigin(origin: string): boolean {
    if (AUTH_CONSTANTS.csrf.allowedOrigins.length === 0) {
      return false;
    }

    return AUTH_CONSTANTS.csrf.allowedOrigins.includes(origin);
  }

  private normalizeOrigin(originHeader: string | string[] | undefined): string | null {
    if (!originHeader) return null;
    const raw = Array.isArray(originHeader) ? originHeader[0] : originHeader;
    const normalized = raw.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private extractRefererOrigin(refererHeader: string | string[] | undefined): string | null {
    if (!refererHeader) return null;
    const referer = Array.isArray(refererHeader) ? refererHeader[0] : refererHeader;

    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
}
```

### 6) `api/src/modules/auth/presentation/http/auth.controller.ts` (trechos-chave)

```ts
import { ApiCookieAuth } from '@nestjs/swagger';
import { AUTH_CONSTANTS } from '@/common/models/constants';
import { type AuthRequest } from '@/common/models/interfaces/auth-request.interface';
import { OriginGuard } from '@/common/guards/origin.guard';

// sign-up / sign-in / refresh / google callback
this.setAccessTokenCookie(res, tokens.accessToken);
this.setRefreshTokenCookie(res, tokens.refreshToken);
return { accessToken: tokens.accessToken }; // remover na Fase 3 (cookie-only final)

// logout (fase de transição)
const accessTokenFromCookie = req.cookies[AUTH_CONSTANTS.cookies.accessTokenKey];
const accessTokenFromHeader = this.extractBearerToken(authHeader);
const accessToken =
  accessTokenFromCookie ??
  (AUTH_CONSTANTS.compatibility.acceptBearer ? accessTokenFromHeader : null);

if (!accessToken) {
  this.clearAccessTokenCookie(res);
  this.clearRefreshTokenCookie(res);
  throw new UnauthorizedException('Access token not found');
}

await this.logoutUseCase.execute({ userId: user.id, accessToken, refreshToken });

this.clearAccessTokenCookie(res);
this.clearRefreshTokenCookie(res);
```

```ts
// callback OAuth sem token em query
const frontendUrl = this.appConfiguration.frontendUrl;
return res.redirect(`${frontendUrl}/auth/callback`);
```

```ts
// helpers de cookie
private setAccessTokenCookie(res: Response, accessToken: string) {
  res.cookie(AUTH_CONSTANTS.cookies.accessTokenKey, accessToken, {
    httpOnly: true,
    secure: AUTH_CONSTANTS.cookies.secure,
    sameSite: AUTH_CONSTANTS.cookies.sameSite,
    path: AUTH_CONSTANTS.cookies.accessTokenPath,
    maxAge: ms(this.jwtConfiguration.accessExpiresIn as StringValue),
  });
}

private clearAccessTokenCookie(res: Response) {
  res.clearCookie(AUTH_CONSTANTS.cookies.accessTokenKey, {
    path: AUTH_CONSTANTS.cookies.accessTokenPath,
  });
}

private extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}
```

```ts
// aplicar OriginGuard em rotas mutáveis protegidas
@Post('refresh')
@UseGuards(JwtRefreshGuard, OriginGuard)

@Delete('sessions/:jti')
@UseGuards(JwtAuthGuard, OriginGuard)

@Post('logout')
@UseGuards(JwtAuthGuard, OriginGuard)

@Post('providers/link/email')
@UseGuards(JwtAuthGuard, OriginGuard)
```

### 7) `api/src/modules/auth/auth.module.ts` (registrar guard)

```ts
import { OriginGuard } from '@/common/guards/origin.guard';

@Module({
  // ...
  providers: [
    // ...
    OriginGuard,
  ],
})
export class AuthModule {}
```

### 8) `api/src/main.ts` (Swagger cookie auth)

```ts
const config = new DocumentBuilder()
  .setTitle('Finance App API')
  .setDescription('API de controle financeiro')
  .setVersion('1.0')
  .addTag('auth', 'Autenticação e Sessões')
  .addTag('users', 'Perfil e dados do usuário autenticado')
  .addTag('health', 'Health checks da aplicação')
  .addTag('app', 'Informações públicas da API')
  .addCookieAuth(
    'accessToken',
    {
      type: 'apiKey',
      in: 'cookie',
      name: 'accessToken',
      description: 'JWT access token via HttpOnly cookie',
    },
    'access-cookie',
  )
  .addBearerAuth(undefined, 'bearer') // opcional na fase de transição
  .build();
```

### 9) Controllers protegidos (Swagger decorators)

```ts
import { ApiCookieAuth, ApiBearerAuth } from '@nestjs/swagger';

@ApiCookieAuth('access-cookie')
@ApiBearerAuth('bearer') // remover no estado final
```

### 10) `.env.exemple` (novas variáveis)

```env
# Compatibilidade temporária com Authorization: Bearer
AUTH_ACCEPT_BEARER=true

# Origins permitidas para validação anti-CSRF (csv)
CSRF_ALLOWED_ORIGINS=http://localhost:5173,https://app.seu-dominio.com
```

---

## Plano de migração completa

### Fase 1 — Compatível (sem quebra imediata)
1. Implementar cookie extractor + fallback Bearer.
2. Passar a setar `accessToken` também em cookie.
3. Manter retorno de `accessToken` no body por 1 versão (opcional, recomendado para transição).
4. Incluir `OriginGuard` nas rotas de mutação.
5. Ajustar callback Google para não expor token em query.

### Fase 2 — Cookie como padrão
1. Atualizar docs e Swagger para cookie auth.
2. Marcar Bearer como deprecated.
3. Validar logs/telemetria de 401/403 e comportamento de CORS/cookies em produção.

### Fase 3 — Cookie-only (estado final)
1. `AUTH_ACCEPT_BEARER=false`.
2. Remover parsing de `Authorization` no logout.
3. Remover `accessToken` do body (se ainda existir).
4. Remover referências de Bearer nos docs.

---

## Critérios de aceite
- Endpoints protegidos funcionam apenas com cookie de access token (fase final).
- `refresh` continua rotacionando e renovando sessão normalmente.
- `logout` blacklista access token e limpa ambos os cookies.
- OAuth callback não carrega token na URL.
- Requisições cross-site mutáveis sem `Origin/Referer` válido recebem `403`.
- Swagger e documentação refletem autenticação por cookie.

---

## Testes recomendados

### Unit
- extractor de token (cookie, fallback Bearer habilitado/desabilitado).
- `OriginGuard`:
  - origin permitido
  - referer permitido
  - origin ausente e referer ausente
  - origin inválido

### E2E
1. `sign-in` seta `accessToken` + `refreshToken`.
2. `GET /users/me` autenticado só com cookie.
3. `POST /auth/refresh` renova access cookie e refresh cookie.
4. `POST /auth/logout` limpa cookies e invalida token.
5. `POST/DELETE` com origem inválida retorna `403`.
6. Callback Google redireciona sem `accessToken` na query.

---

## Riscos e mitigação
- **Risco:** CSRF em endpoints mutáveis.  
  **Mitigação:** `OriginGuard` + `SameSite=Lax` + HTTPS.

- **Risco:** cookie path incorreto quebrar autenticação fora de `/auth`.  
  **Mitigação:** `accessToken` com `Path=/`.

- **Risco:** limpeza de cookie falhar por mismatch de opções.  
  **Mitigação:** limpar com mesmo `path` e atributos relevantes.

- **Risco:** regressão em clientes legados.  
  **Mitigação:** fase compatível com `AUTH_ACCEPT_BEARER=true` antes do corte final.

---

## Recomendação final
Executar em 3 fases (compatível → padrão cookie → cookie-only), com `OriginGuard` já na Fase 1.  
Isso reduz risco de regressão e permite uma migração completa com segurança adequada para o cenário atual.
