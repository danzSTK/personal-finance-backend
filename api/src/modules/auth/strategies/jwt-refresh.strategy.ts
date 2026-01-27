import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { type ConfigType } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { type Cache } from 'cache-manager';
import jwtConfig from '../../../config/jwt.config';
import { type JwtPayloadDto } from '../dto/jwt-payload.dto';
import { CacheKeys } from '../../../common/utils/cache-keys.factory';
import { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {
    super({
      // O token vem no corpo da requisição: { "refreshToken": "..." }
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: jwtConfiguration.refreshSecret,
    });
  }

  async validate(req: Request, payload: JwtPayloadDto) {
    const userId = payload.sub;
    const jti = payload.jti;

    if (!jti) {
      throw new UnauthorizedException('Token identifier (jti) missing');
    }

    // 1. Monta a chave exata onde salvamos no generateToken
    const key = CacheKeys.auth.refreshToken(userId, jti);

    // 2. Busca no Redis
    const storedToken = await this.cacheManager.get<string>(key);

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
