import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type ConfigType } from '@nestjs/config';
import jwtConfig from '@/config/jwt.config';
import { InvalidRefreshTokenError } from '@/modules/auth/application/errors';

interface RefreshTokenPayload {
  jti?: string;
}

@Injectable()
export class RefreshTokenValidationService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}

  getSessionJti(rawRefreshToken: unknown): string {
    if (typeof rawRefreshToken !== 'string' || rawRefreshToken.trim() === '') {
      throw new InvalidRefreshTokenError('Refresh token not found.');
    }

    let payload: RefreshTokenPayload;

    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(rawRefreshToken, {
        secret: this.jwtConfiguration.refreshSecret,
        issuer: this.jwtConfiguration.issuer,
      });
    } catch {
      throw new InvalidRefreshTokenError('Refresh token invalid or expired.');
    }

    if (!payload.jti) {
      throw new InvalidRefreshTokenError('Token identifier (jti) missing.');
    }

    return payload.jti;
  }
}
