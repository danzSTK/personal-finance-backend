import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@/modules/users/entities/user.entity';

import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { UsersService } from '@/modules/users/users.service';
import jwtConfig from '@/config/jwt.config';
import { type ConfigType } from '@nestjs/config';

import { AuthProviderService } from '@/modules/auth-provider/auth-provider.service';
import { AuthProviderType } from '@/common/models/enums/auth-provider.enum';
import { IHashService } from '@/common/models/interfaces/hash.service.interface';
import { RegisterDto } from './dto/register.dto';
import { UserStatus } from '@/common/models/enums/user-status.enum';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { GoogleUserProfileDto } from '../auth-provider/dto/google-user-profile.dto';
import { type Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { JwtPayloadDto } from './dto/jwt-payload.dto';
import { randomUUID } from 'node:crypto';
import { REDIS_CLIENT } from '@/database/redis/redis.provider';
import Redis from 'ioredis';
import ms, { StringValue } from 'ms';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly authProviderService: AuthProviderService,

    private readonly hashService: IHashService,
    @InjectDataSource()
    private readonly dataSource: DataSource,

    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,

    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async rotateTokens(userId: string, oldJti: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const oldRtKey = CacheKeys.auth.refreshToken(userId, oldJti);
    const isValid = await this.redis.get(oldRtKey);

    console.log('token key', oldRtKey);
    console.log('token value', isValid);

    if (!isValid) {
      await this.invalidAllSessions(userId);
      throw new UnauthorizedException('Potential session hijacking');
    }

    const sessionkey = CacheKeys.auth.userSessions(userId);
    await Promise.all([this.redis.del(oldRtKey), this.redis.srem(sessionkey, oldJti)]);

    return this.generateToken(user);
  }

  async invalidAllSessions(userId: string) {
    const sessionKey = CacheKeys.auth.userSessions(userId);

    const activeSessionsJtis = await this.redis.smembers(sessionKey);

    if (activeSessionsJtis.length > 0) {
      const rtKeys = activeSessionsJtis.map(jti => CacheKeys.auth.refreshToken(userId, jti));

      await Promise.all([...rtKeys.map(key => this.redis.del(key)), this.redis.del(sessionKey)]);
    }
  }

  async logout(userId: string, accessToken: string, refreshTokenJti: string) {
    console.log('userId', userId);
    console.log('accessToken', accessToken);
    console.log('refreshTokenJti', refreshTokenJti);
    const payloadToken = this.jwtService.decode<JwtPayloadDto>(accessToken);

    if (!payloadToken || !payloadToken.exp) {
      throw new UnauthorizedException('Invalid access token');
    }

    const accessTokenJti = payloadToken.jti;

    const currentTime = Math.floor(Date.now() / 1000);
    const remainingTime = payloadToken.exp - currentTime;

    const sessionKey = CacheKeys.auth.userSessions(userId);
    const rtKey = CacheKeys.auth.refreshToken(userId, refreshTokenJti);
    const blacklistKey = CacheKeys.auth.blackList(accessTokenJti);

    const ttl = remainingTime > 0 ? remainingTime : 1;

    await Promise.all([
      this.redis.setex(blacklistKey, ttl, '1'),
      this.redis.del(rtKey),
      this.redis.srem(sessionKey, refreshTokenJti),
    ]);

    return true;
  }

  /**
   *
   * Valida email e senha do usuário
   * chamado pelo LocalStrategy
   */

  async validateUserCredentials(email: string, password: string): Promise<User | null> {
    const localProvider = await this.authProviderService.findByProviderAndProviderId(AuthProviderType.EMAIL, email);

    if (!localProvider || !localProvider.passwordHash) {
      return null;
    }

    const isPasswordValid = await this.hashService.compare(password, localProvider.passwordHash);

    if (!isPasswordValid) {
      return null;
    }

    const user = await this.usersService.findById(localProvider.user_id);

    if (!user) {
      throw new InternalServerErrorException('User not found for valid credentials');
    }

    if (user.status === UserStatus.BLOCKED) {
      return null;
    }

    return user;
  }

  /**
   * REGISTRO DE NOVO USUÁRIO (EMAIL/SENHA)
   *
   * 🧠 LÓGICA:
   * 1. Verifica se existe AuthProvider(EMAIL, email)
   * 2. Se existir → erro (não pode ter 2 contas EMAIL com mesmo email)
   * 3. Se não existir:
   *    a. Verifica se existe User com esse email
   *    b. Se sim → vincula AuthProvider ao User existente
   *    c. Se não → cria novo User + AuthProvider
   */
  async signUp(data: RegisterDto) {
    const existingProvider = await this.authProviderService.findByProviderAndProviderId(
      AuthProviderType.EMAIL,
      data.email,
    );

    if (existingProvider) {
      throw new ConflictException('Email already registered');
    }

    const existingUser = await this.usersService.findByUserName(data.userName);

    if (existingUser) {
      throw new ConflictException('User name already registered');
    }

    const passwordHash = await this.hashService.hash(data.password);

    const result = await this.dataSource.transaction(async manager => {
      let user = await this.usersService.findByEmail(data.email);

      if (user) {
        // ✅ CENÁRIO: Usuário já tem conta (ex: Google), agora quer adicionar login por email
        // adicionar authProvider EMAIL ao User existente
        await this.authProviderService.createAuthProvider(
          {
            passwordHash,
            provider: AuthProviderType.EMAIL,
            user_id: user.id,
            providerUserId: data.email,
          },
          manager,
        );

        return user;
      }

      // ✅ CENÁRIO: Novo usuário, criar User + AuthProvider EMAIL
      user = await this.usersService.create(
        {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          userName: data.userName,
          status: UserStatus.ACTIVE,
        },
        {
          manager,
        },
      );

      await this.authProviderService.createAuthProvider(
        {
          passwordHash,
          provider: AuthProviderType.EMAIL,
          user_id: user.id,
          providerUserId: data.email,
        },
        manager,
      );

      return user;
    });

    return this.generateToken(result);
  }

  // Guard Gerencia o fluxo de login
  signIn(user: User) {
    return this.generateToken(user);
  }

  /**
   * 🌐 VALIDAR OU CRIAR USUÁRIO DO GOOGLE
   *
   * 🧠 LÓGICA:
   * 1. Verifica se existe AuthProvider(GOOGLE, googleId)
   * 2. Se existir → retorna User vinculado
   * 3. Se não existir:
   *    a. Verifica se existe User com esse email
   *    b. Se sim → vincula AuthProvider GOOGLE ao User existente
   *    c. Se não → cria novo User + AuthProvider GOOGLE
   */

  async validateOrCreateGoogleUser(googleUserDto: GoogleUserProfileDto): Promise<User> {
    const { googleId, email, name } = googleUserDto;

    const existingAuthProvider = await this.authProviderService.findByProviderAndProviderId(
      AuthProviderType.GOOGLE,
      googleId,
    );

    if (existingAuthProvider) {
      const user = await this.usersService.findById(existingAuthProvider.user_id);

      if (!user) {
        throw new InternalServerErrorException('User linked to Google AuthProvider not found');
      }

      return user;
    }

    // 2️⃣ Transaction: criar/vincular User + AuthProvider
    const result = await this.dataSource.transaction(async manager => {
      // 2.1 Verificar se existe User com esse email
      let user = email ? await this.usersService.findByEmail(email, { manager }) : null;

      // ✅ CENÁRIO: Usuário já tem conta (ex: email/senha), agora quer vincular Google
      if (user) {
        await this.authProviderService.createAuthProvider(
          {
            provider: AuthProviderType.GOOGLE,
            providerUserId: googleId,
            passwordHash: null,
            user_id: user.id,
          },
          manager,
        );

        return user;
      }

      // 2.2 Criar novo User (primeira vez no sistema)
      // Extrair firstName e lastName do displayName
      const nameParts = name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      user = await this.usersService.create(
        {
          email,
          firstName,
          lastName,
        },
        {
          manager,
        },
      );

      await this.authProviderService.createAuthProvider({
        provider: AuthProviderType.GOOGLE,
        providerUserId: googleId,
        user_id: user.id,
        passwordHash: null,
      });

      return user;
    });

    return result;
  }

  async generateToken(user: User) {
    const accessTokenPayload: JwtPayloadDto = {
      jti: randomUUID(),
      sub: user.id,
      email: user.email,
      status: user.status,
    };

    const refreshTokenPayload: JwtPayloadDto = {
      jti: randomUUID(),
      sub: user.id,
      email: user.email,
      status: user.status,
    };

    const tokens = {
      accessToken: this.jwtService.sign(accessTokenPayload, {
        issuer: this.jwtConfiguration.issuer,
        expiresIn: this.jwtConfiguration.accessExpiresIn,
      } as JwtSignOptions),
      refreshToken: this.jwtService.sign(refreshTokenPayload, {
        secret: this.jwtConfiguration.refreshSecret,
        expiresIn: `${this.jwtConfiguration.refreshExpiresIn}`,
      } as JwtSignOptions),
    };

    const rtKey = CacheKeys.auth.refreshToken(user.id, refreshTokenPayload.jti);
    const sessionKey = CacheKeys.auth.userSessions(user.id);

    const rtTokenTtl = this.getSeconds(this.jwtConfiguration.refreshExpiresIn as StringValue);

    await Promise.all([
      this.redis.setex(rtKey, rtTokenTtl, '1'),
      this.redis.sadd(sessionKey, refreshTokenPayload.jti),
      this.redis.expire(sessionKey, rtTokenTtl),
    ]);

    return tokens;
  }

  private getSeconds = (time: StringValue | number): number => {
    if (typeof time === 'number') {
      return time;
    }

    return Math.floor(ms(time) / 1000);
  };
}
