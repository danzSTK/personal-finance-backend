import { ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { User } from '../users/domain/entities/user.entity';

import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import jwtConfig from '@/config/jwt.config';
import { type ConfigType } from '@nestjs/config';

import { AuthProviderType, UserStatus } from '@/common/models/enums';
import { IHashService, ActiveSession, SessionMetadata } from '@/common/models/interfaces';
import { RegisterDto } from './dto/register.dto';

import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { GoogleUserProfileDto } from './dto/google-user-profile.dto';
import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { JwtPayloadDto } from './dto/jwt-payload.dto';
import { randomUUID } from 'node:crypto';
import ms, { StringValue } from 'ms';
import { RedisService } from '../../database/redis/redis.service';
import { FindUserByIdUseCase } from '../users/application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { FindUserByEmailUseCase } from '../users/application/use-cases/find-by-user-email/find-user-by-email.use-case';
import { CreateUserUseCase } from '../users/application/use-cases/create-user/create-user.use-case';
import { FindUserByUserNameUseCase } from '../users/application/use-cases/find-by-user-name/find-by-user-name.use-case';
import { IUserRepository } from '../users/domain/repositories/user.respository.interface';
import { HashedPassword } from '../users/domain/value-objects/hashed-password.value-object';

@Injectable()
export class AuthService {
  constructor(
    private readonly findUserByIdUseCase: FindUserByIdUseCase,
    private readonly findUserByEmailUseCase: FindUserByEmailUseCase,
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly findUserByUsernameUseCase: FindUserByUserNameUseCase,
    private readonly userRepository: IUserRepository,

    private readonly jwtService: JwtService,

    private readonly hashService: IHashService,
    @InjectDataSource()
    private readonly dataSource: DataSource,

    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,

    private readonly redisService: RedisService,
  ) {}

  async rotateTokens(userId: string, oldJti: string, sessionMetadata: SessionMetadata) {
    const user = await this.findUserByIdUseCase.execute(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const oldRtKey = CacheKeys.auth.refreshToken(userId, oldJti);
    const isValid = await this.redisService.get<SessionMetadata>(oldRtKey);

    if (!isValid) {
      await this.invalidAllSessions(userId);
      throw new UnauthorizedException('Potential session hijacking');
    }

    const sessionkey = CacheKeys.auth.userSessions(userId);
    await Promise.all([this.redisService.del(oldRtKey), this.redisService.srem(sessionkey, oldJti)]);

    return this.generateToken(user, sessionMetadata);
  }

  async invalidAllSessions(userId: string) {
    const sessionKey = CacheKeys.auth.userSessions(userId);

    const activeSessionsJtis = await this.redisService.smembers(sessionKey);

    if (activeSessionsJtis.length > 0) {
      const rtKeys = activeSessionsJtis.map(jti => CacheKeys.auth.refreshToken(userId, jti));

      await Promise.all([...rtKeys.map(key => this.redisService.del(key)), this.redisService.del(sessionKey)]);
    }
  }

  async revokeSession(userId: string, jti: string) {
    const sessionKey = CacheKeys.auth.userSessions(userId);
    const rtKey = CacheKeys.auth.refreshToken(userId, jti);

    const existsRt = await this.redisService.exists(rtKey);

    if (!existsRt) {
      throw new NotFoundException('Session not found');
    }

    await Promise.all([this.redisService.del(rtKey), this.redisService.srem(sessionKey, jti)]);
  }

  async logout(userId: string, accessToken: string, refreshTokenJti: string) {
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
      this.redisService.setex(blacklistKey, ttl, '1'),
      this.redisService.del(rtKey),
      this.redisService.srem(sessionKey, refreshTokenJti),
    ]);

    return true;
  }

  /**
   *
   * Valida email e senha do usuário
   * chamado pelo LocalStrategy
   */

  async validateUserCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.findUserByEmailUseCase.execute(email);

    if (!user) {
      return null;
    }

    const credentialsProvider = user.getCredentialsAuthProvider();

    if (!credentialsProvider) {
      return null;
    }

    const isValid = await this.hashService.compare(password, credentialsProvider.passwordHash.value);

    if (!isValid) return null;

    if (user.status === UserStatus.BLOCKED) return null;

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
  async signUp(data: RegisterDto, sessionMetadata: SessionMetadata) {
    const passwordHash = await this.hashService.hash(data.password);

    const result = await this.dataSource.transaction(async manager => {
      const user = await this.findUserByEmailUseCase.execute(data.email, { manager });

      if (user) {
        // ✅ CENÁRIO: Usuário já tem conta (ex: Google), agora quer adicionar login por email
        // adicionar authProvider EMAIL ao User existente
        if (user.hasAuthProvider(AuthProviderType.EMAIL, data.email)) {
          throw new ConflictException('Email already registered');
        }

        user.addAuthProvider(
          crypto.randomUUID(),
          AuthProviderType.EMAIL,
          data.email,
          HashedPassword.createFromHash(passwordHash),
        );

        return this.userRepository.save(user, { manager });
      }

      const existingUsername = await this.findUserByUsernameUseCase.execute(data.userName, { manager });

      if (existingUsername) {
        throw new ConflictException('User name already registered');
      }

      // ✅ CENÁRIO: Novo usuário, criar User + AuthProvider EMAIL
      return this.createUserUseCase.execute(
        {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          userName: data.userName,
          status: UserStatus.ACTIVE,
          authProviders: [
            {
              provider: AuthProviderType.EMAIL,
              providerUserId: data.email,
              passwordHash: passwordHash,
            },
          ],
        },
        {
          manager,
        },
      );
    });

    return this.generateToken(result, sessionMetadata);
  }

  // Guard Gerencia o fluxo de login
  signIn(user: User, sessionMetadata: SessionMetadata) {
    return this.generateToken(user, sessionMetadata);
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

    const existingAuthProvider = await this.userRepository.findByAuthProvider(AuthProviderType.GOOGLE, googleId);

    if (existingAuthProvider) {
      return existingAuthProvider;
    }

    return this.dataSource.transaction(async manager => {
      const user = await this.findUserByEmailUseCase.execute(email, { manager });

      if (user) {
        user.addAuthProvider(randomUUID(), AuthProviderType.GOOGLE, googleId, null);

        return this.userRepository.save(user, { manager });
      }

      const [firstName, ...rest] = name.split(' ');

      return this.createUserUseCase.execute(
        {
          email,
          firstName,
          lastName: rest.join(' ') || '',
          status: UserStatus.PENDING_PROFILE,
          authProviders: [
            {
              provider: AuthProviderType.GOOGLE,
              providerUserId: googleId,
              passwordHash: null,
            },
          ],
        },
        { manager },
      );
    });
  }

  async getActiveSessions(userId: string): Promise<ActiveSession[]> {
    const sessionKey = CacheKeys.auth.userSessions(userId);

    const jtis = await this.redisService.smembers(sessionKey);

    if (jtis.length === 0) return [];

    const rtKeys = jtis.map(jti => CacheKeys.auth.refreshToken(userId, jti));

    const sessionsData = await this.redisService.mget(...rtKeys);

    return sessionsData
      .map((data, index) => {
        if (!data) return null;

        const metadata = JSON.parse(data) as SessionMetadata;

        return {
          jti: jtis[index],
          ...metadata,
        };
      })
      .filter((session): session is ActiveSession => session !== null);
  }

  async generateToken(user: User, sessionMetadata: SessionMetadata) {
    console.log('metadata', sessionMetadata);
    const accessTokenPayload: JwtPayloadDto = {
      jti: randomUUID(),
      sub: user.id,
      email: user.email.value,
      status: user.status,
    };

    const refreshTokenPayload: JwtPayloadDto = {
      jti: randomUUID(),
      sub: user.id,
      email: user.email.value,
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

    const rtValue = JSON.stringify(sessionMetadata);

    await Promise.all([
      this.redisService.setex(rtKey, rtTokenTtl, rtValue),
      this.redisService.sadd(sessionKey, refreshTokenPayload.jti),
      this.redisService.expire(sessionKey, rtTokenTtl),
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
