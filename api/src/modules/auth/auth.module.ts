import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigType } from '@nestjs/config';
import jwtConfig from '../../config/jwt.config';
import { AuthProviderModule } from '../auth-provider/auth-provider.module';
import { CommonModule } from '../../common/common.module';
import { PassportModule } from '@nestjs/passport';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google-strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

@Module({
  imports: [
    UsersModule,
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
    AuthProviderModule,
    CommonModule,
    PassportModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, GoogleStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
