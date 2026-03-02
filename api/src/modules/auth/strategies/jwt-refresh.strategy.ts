import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { type ConfigType } from '@nestjs/config';
import jwtConfig from '../../../config/jwt.config';
import { type JwtPayloadDto } from '../dto/jwt-payload.dto';
import { CacheKeys } from '../../../common/utils/cache-keys.factory';
import { type AuthRequest } from '@/common/models/interfaces/auth-request.interface';
import { RedisService } from '../../../database/redis/redis.service';
import { SessionMetadata } from '../../../common/models/interfaces';
import { RefreshStrategyResponse } from '../interfaces/refresh-strategy-response.interface';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly redisService: RedisService,
  ) {
    super({
      // O token vem no header cookie da requisição
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

    // 1. Monta a chave exata onde salvamos no generateToken
    const key = CacheKeys.auth.refreshToken(userId, jti);

    // 2. Busca no Redis
    const storedToken = await this.redisService.get<SessionMetadata>(key);

    // 3. Validação Whitelist (Tem que estar no Redis E ser igual)
    if (!storedToken) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }

    // Retorna o usuário + JTI para podermos apagar esse token depois (rotação)
    return {
      id: userId,
      oldRefreshTokenJti: jti,
    };
  }
}
