import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { type ConfigType } from '@nestjs/config';
import jwtConfig from '@/config/jwt.config';
import { type AuthRequest } from '@/common/models/interfaces/auth-request.interface';
import { ISessionRepository } from '@/modules/auth/domain/repositories/session.repository.interface';
import { type JwtPayloadDto } from '@/modules/auth/presentation/dto/jwt-payload.dto';
import { type RefreshStrategyResponse } from './refresh-strategy-response.interface';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly sessionRepository: ISessionRepository,
    private readonly userRepository: IUserRepository,
  ) {
    super({
      jwtFromRequest: (req: AuthRequest) => {
        return req?.cookies?.refreshToken || null;
      },
      ignoreExpiration: false,
      secretOrKey: jwtConfiguration.refreshSecret,
      issuer: jwtConfiguration.issuer,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayloadDto): Promise<RefreshStrategyResponse> {
    const userId = payload.sub;
    const jti = payload.jti;

    if (!jti) {
      throw new UnauthorizedException('Token identifier (jti) missing');
    }

    const credentialVersion = await this.userRepository.findCredentialVersionById(userId);

    if (credentialVersion === null || (payload.credentialVersion ?? 1) !== credentialVersion) {
      throw new UnauthorizedException('Refresh token revoked or expired');
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
