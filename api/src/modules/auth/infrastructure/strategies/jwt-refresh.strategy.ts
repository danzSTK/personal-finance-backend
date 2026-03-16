import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { type ConfigType } from '@nestjs/config';
import jwtConfig from '../../../../config/jwt.config';
import { type AuthRequest } from '@/common/models/interfaces/auth-request.interface';
import { ISessionRepository } from '../../domain/repositories/session.repository.interface';
import { type JwtPayloadDto } from '../../presentation/dto/jwt-payload.dto';
import { type RefreshStrategyResponse } from './refresh-strategy-response.interface';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly sessionRepository: ISessionRepository,
  ) {
    super({
      jwtFromRequest: (req: AuthRequest) => {
        return req?.cookies?.refreshToken || null;
      },
      ignoreExpiration: false,
      secretOrKey: jwtConfiguration.refreshSecret,
    });
  }

  async validate(payload: JwtPayloadDto): Promise<RefreshStrategyResponse> {
    const userId = payload.sub;
    const jti = payload.jti;

    if (!jti) {
      throw new UnauthorizedException('Token identifier (jti) missing');
    }

    const storedToken = await this.sessionRepository.getSession(userId, jti);

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }

    return {
      id: userId,
      oldRefreshTokenJti: jti,
    };
  }
}
