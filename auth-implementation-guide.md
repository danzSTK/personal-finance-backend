# 🚀 Implementação Completa: Login EMAIL com JWT

## 📋 Checklist Geral
- [x] Configuração JWT (jwt.config.ts)
- [x] JWT Strategy (jwt.strategy.ts)
- [ ] DTOs de Auth
- [ ] JWT Guard
- [ ] Decorator @CurrentUser
- [ ] AuthService
- [ ] AuthController
- [ ] AuthModule
- [ ] Testar tudo

---

## ETAPA 1: Criar os DTOs

### 📁 Crie a pasta: `src/modules/auth/dto`

### 📄 Arquivo 1: `src/modules/auth/dto/register.dto.ts`
```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres' })
  password: string;
}
```

### 📄 Arquivo 2: `src/modules/auth/dto/login.dto.ts`
```typescript
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  password: string;
}
```

### 📄 Arquivo 3: `src/modules/auth/dto/jwt-payload.dto.ts`
```typescript
export class JwtPayloadDto {
  sub: string; // userId
  email: string | null;
  status: string;
}
```

**✅ Confirme:** Você criou os 3 arquivos? Digite "ETAPA 1 OK"

---

## ETAPA 2: Criar o JWT Guard

### 📁 Crie a pasta: `src/modules/auth/guards`

### 📄 Arquivo: `src/modules/auth/guards/jwt-auth.guard.ts`
```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Este guard usa a Strategy 'jwt' que você criou
  // Ele automaticamente:
  // 1. Extrai o token do header
  // 2. Chama a JwtStrategy para validar
  // 3. Se válido, anexa user na request
  // 4. Se inválido, retorna 401 Unauthorized
  
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
```

**✅ Confirme:** Guard criado? Digite "ETAPA 2 OK"

---

## ETAPA 3: Criar o Decorator @CurrentUser

### 📁 Crie a pasta: `src/modules/auth/decorators`

### 📄 Arquivo: `src/modules/auth/decorators/current-user.decorator.ts`
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';

// Este decorator extrai o usuário que foi anexado na request pela Strategy
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // A Strategy colocou o User aqui
  },
);
```

**✅ Confirme:** Decorator criado? Digite "ETAPA 3 OK"

---

## ETAPA 4: Criar o AuthService

### 📄 Arquivo: `src/modules/auth/auth.service.ts`
```typescript
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity';
import { AuthProvider } from '../../entities/auth-provider.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayloadDto } from './dto/jwt-payload.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(AuthProvider)
    private authProviderRepository: Repository<AuthProvider>,

    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // ============================================
  // REGISTRO DE NOVO USUÁRIO
  // ============================================
  async register(dto: RegisterDto) {
    // 1. Verifica se já existe um AuthProvider com esse email
    const existingProvider = await this.authProviderRepository.findOne({
      where: {
        provider: 'EMAIL',
        provider_user_id: dto.email,
      },
    });

    if (existingProvider) {
      throw new ConflictException('Email já cadastrado');
    }

    // 2. Cria o usuário (PENDING_PROFILE pois não tem dados ainda)
    const user = this.userRepository.create({
      email: dto.email,
      status: 'PENDING_PROFILE',
    });

    await this.userRepository.save(user);

    // 3. Hash da senha (NUNCA salvar senha em texto puro!)
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 4. Cria o AuthProvider vinculado ao usuário
    const authProvider = this.authProviderRepository.create({
      user_id: user.id,
      provider: 'EMAIL',
      provider_user_id: dto.email,
      password_hash: passwordHash,
    });

    await this.authProviderRepository.save(authProvider);

    // 5. Gera os tokens JWT
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
      },
      ...tokens,
    };
  }

  // ============================================
  // LOGIN
  // ============================================
  async login(dto: LoginDto) {
    // 1. Busca o AuthProvider pelo email
    const authProvider = await this.authProviderRepository.findOne({
      where: {
        provider: 'EMAIL',
        provider_user_id: dto.email,
      },
      relations: ['user'], // Traz o User junto
    });

    if (!authProvider) {
      // Mensagem genérica por segurança
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // 2. Verifica a senha
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      authProvider.password_hash!,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // 3. Verifica se o usuário não está bloqueado
    if (authProvider.user.status === 'BLOCKED') {
      throw new UnauthorizedException('Usuário bloqueado');
    }

    // 4. Gera os tokens
    const tokens = await this.generateTokens(authProvider.user);

    return {
      user: {
        id: authProvider.user.id,
        email: authProvider.user.email,
        status: authProvider.user.status,
      },
      ...tokens,
    };
  }

  // ============================================
  // GERAR TOKENS (access + refresh)
  // ============================================
  private async generateTokens(user: User) {
    const payload: JwtPayloadDto = {
      sub: user.id,
      email: user.email,
      status: user.status,
    };

    const [accessToken, refreshToken] = await Promise.all([
      // Access Token (15min)
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: this.configService.get<string>('jwt.accessExpiresIn'),
      }),

      // Refresh Token (7 dias)
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  // ============================================
  // REFRESH TOKEN (renovar access_token)
  // ============================================
  async refreshTokens(refreshToken: string) {
    try {
      // Valida o refresh token com o secret correto
      const payload = await this.jwtService.verifyAsync<JwtPayloadDto>(
        refreshToken,
        {
          secret: this.configService.get<string>('jwt.refreshSecret'),
        },
      );

      // Busca o usuário para garantir que ainda existe
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || user.status === 'BLOCKED') {
        throw new UnauthorizedException('Token inválido');
      }

      // Gera novos tokens
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}
```

**✅ Confirme:** AuthService criado? Digite "ETAPA 4 OK"

---

## ETAPA 5: Criar o AuthController

### 📄 Arquivo: `src/modules/auth/auth.controller.ts`
```typescript
import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ROTA PÚBLICA: Registro
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // ROTA PÚBLICA: Login
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ROTA PÚBLICA: Renovar tokens
  @Post('refresh')
  refresh(@Body('refresh_token') refreshToken: string) {
    return this.authService.refreshTokens(refreshToken);
  }

  // ROTA PROTEGIDA: Dados do usuário logado
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      userName: user.userName,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
    };
  }
}
```

**✅ Confirme:** AuthController criado? Digite "ETAPA 5 OK"

---

## ETAPA 6: Criar o AuthModule

### 📄 Arquivo: `src/modules/auth/auth.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../users/entities/user.entity';
import { AuthProvider } from '../../entities/auth-provider.entity';

@Module({
  imports: [
    // Registra as entities que o AuthModule vai usar
    TypeOrmModule.forFeature([User, AuthProvider]),

    // Configura o Passport (biblioteca de autenticação)
    PassportModule,

    // Configura o JWT Module (geração e validação de tokens)
    JwtModule.register({}), // Config vazia pois usamos dynamic secrets no service
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService], // Exporta caso outro módulo precise
})
export class AuthModule {}
```

**✅ Confirme:** AuthModule criado? Digite "ETAPA 6 OK"

---

## ETAPA 7: Registrar no AppModule

### 📄 Arquivo: `src/app.module.ts`
Adicione o `AuthModule` nos imports:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
// ... outros imports

@Module({
  imports: [
    // ... outros módulos
    AuthModule, // <<< ADICIONE AQUI
    UsersModule,
  ],
})
export class AppModule {}
```

**✅ Confirme:** AppModule atualizado? Digite "ETAPA 7 OK"

---

## ETAPA 8: TESTAR!

### Instale a dependência do bcrypt:
```bash
npm install bcrypt
npm install -D @types/bcrypt
```

### Inicie o servidor:
```bash
npm run start:dev
```

### Teste 1: Registro
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@email.com",
    "password": "senha123"
  }'
```

**Resposta esperada:**
```json
{
  "user": {
    "id": "uuid-aqui",
    "email": "teste@email.com",
    "status": "PENDING_PROFILE"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Teste 2: Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@email.com",
    "password": "senha123"
  }'
```

### Teste 3: Rota Protegida
```bash
# Copie o access_token do registro/login e use aqui:
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI"
```

**Resposta esperada:**
```json
{
  "id": "uuid-aqui",
  "email": "teste@email.com",
  "userName": null,
  "firstName": null,
  "lastName": null,
  "status": "PENDING_PROFILE"
}
```

---

## 🎉 CONCLUSÃO

Se todos os testes passaram, você tem:
- ✅ Sistema de registro funcionando
- ✅ Sistema de login funcionando
- ✅ JWT access e refresh tokens sendo gerados
- ✅ Rotas protegidas com Guard
- ✅ Decorator @CurrentUser funcionando

**Próximos passos:**
1. Implementar onboarding para sair de PENDING_PROFILE
2. Adicionar Google/Apple login
3. Implementar refresh token automático no frontend

Qualquer erro, me mostra a mensagem completa!