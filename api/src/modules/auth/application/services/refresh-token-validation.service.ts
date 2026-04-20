import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type ConfigType } from '@nestjs/config';
import jwtConfig from '@/config/jwt.config';

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
      throw new UnauthorizedException('Refresh token not found');
    }

    let payload: RefreshTokenPayload;

    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(rawRefreshToken, {
        secret: this.jwtConfiguration.refreshSecret,
        issuer: this.jwtConfiguration.issuer,
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    if (!payload.jti) {
      throw new UnauthorizedException('Token identifier (jti) missing');
    }

    return payload.jti;
  }
}
