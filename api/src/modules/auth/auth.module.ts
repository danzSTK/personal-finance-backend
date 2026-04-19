import { Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import jwtConfig from '@/config/jwt.config';
import { UsersModule } from '../users/users.module';
import { CommonModule } from '@/common/common.module';

// Domain
import { ISessionRepository } from './domain/repositories/session.repository.interface';

// Application — Use Cases
import { GenerateTokenUseCase } from './application/use-cases/generate-token/generate-token.use-case';
import { SignUpUseCase } from './application/use-cases/sign-up/sign-up.use-case';
import { SignInUseCase } from './application/use-cases/sign-in/sign-in.use-case';
import { LogoutUseCase } from './application/use-cases/logout/logout.use-case';
import { RefreshTokensUseCase } from './application/use-cases/refresh-tokens/refresh-tokens.use-case';
import { GetActiveSessionsUseCase } from './application/use-cases/get-active-sessions/get-active-sessions.use-case';
import { RevokeSessionUseCase } from './application/use-cases/revoke-session/revoke-session.use-case';
import { ValidateCredentialsUseCase } from './application/use-cases/validate-credentials/validate-credentials.use-case';
import { OAuthCallbackUseCase } from './application/use-cases/oauth-callback/oauth-callback.use-case';
import { LinkEmailProviderUseCase } from './application/use-cases/link-email-provider/link-email-provider.use-case';
import { LinkGoogleProviderUseCase } from './application/use-cases/link-google-provider/link-google-provider.use-case';

// Infrastructure — Persistence
import { RedisSessionRepository } from './infrastructure/persistence/redis-session.repository';

// Infrastructure — Strategies
import { LocalStrategy } from './infrastructure/strategies/local.strategy';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { JwtRefreshStrategy } from './infrastructure/strategies/jwt-refresh.strategy';
import { GoogleStrategy } from './infrastructure/strategies/google.strategy';
import { GoogleLinkStrategy } from './infrastructure/strategies/google-link.strategy';
import { GoogleLinkAuthGuard } from './infrastructure/guards/google-link-auth.guard';
import { GoogleLinkInitAuthGuard } from './infrastructure/guards/google-link-init-auth.guard';

// Presentation
import { AuthController } from './presentation/http/auth.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [jwtConfig.KEY],
      useFactory: (jwtConfiguration: ConfigType<typeof jwtConfig>) => ({
        secret: jwtConfiguration.accessSecret,
        signOptions: {
          expiresIn: jwtConfiguration.accessExpiresIn,
          issuer: jwtConfiguration.issuer,
        } as JwtSignOptions,
        verifyOptions: {
          issuer: jwtConfiguration.issuer,
          algorithms: ['HS256'],
        },
      }),
    }),
    UsersModule,
    CommonModule,
    PassportModule,
  ],
  controllers: [AuthController],
  providers: [
    // Repository binding
    {
      provide: ISessionRepository,
      useClass: RedisSessionRepository,
    },

    // Use Cases
    GenerateTokenUseCase,
    SignUpUseCase,
    SignInUseCase,
    LogoutUseCase,
    RefreshTokensUseCase,
    GetActiveSessionsUseCase,
    RevokeSessionUseCase,
    ValidateCredentialsUseCase,
    OAuthCallbackUseCase,
    LinkEmailProviderUseCase,
    LinkGoogleProviderUseCase,

    // Strategies
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
    GoogleStrategy,
    GoogleLinkStrategy,
    GoogleLinkAuthGuard,
    GoogleLinkInitAuthGuard,
  ],
  exports: [ISessionRepository],
})
export class AuthModule {}
