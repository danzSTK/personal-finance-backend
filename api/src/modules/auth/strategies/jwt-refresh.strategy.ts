import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { type ConfigType } from '@nestjs/config';
import jwtConfig from '../../../config/jwt.config';
import { type JwtPayloadDto } from '../dto/jwt-payload.dto';
import { CacheKeys } from '../../../common/utils/cache-keys.factory';
import { REDIS_CLIENT } from '../../../database/redis/redis.provider';
import Redis from 'ioredis';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {
    super({
      // O token vem no corpo da requisição: { "refreshToken": "..." }
      jwtFromRequest: req => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
        return req?.cookies?.refreshToken || null;
      },
      ignoreExpiration: false,
      secretOrKey: jwtConfiguration.refreshSecret,
    });
  }

  async validate(payload: JwtPayloadDto) {
    const userId = payload.sub;
    const jti = payload.jti;

    if (!jti) {
      throw new UnauthorizedException('Token identifier (jti) missing');
    }

    // 1. Monta a chave exata onde salvamos no generateToken
    const key = CacheKeys.auth.refreshToken(userId, jti);

    // 2. Busca no Redis
    const storedToken = await this.redis.get(key);

    console.log('token key', key);
    console.log('token value', storedToken);

    // 3. Validação Whitelist (Tem que estar no Redis E ser igual)
    if (!storedToken) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }

    // Retorna o usuário + JTI para podermos apagar esse token depois (rotação)
    return {
      id: userId,
      email: payload.email,
      jti: jti,
      status: payload.status,
    };
  }
}
