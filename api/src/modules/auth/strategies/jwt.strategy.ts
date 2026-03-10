import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwtConfig from '../../../config/jwt.config';
import type { ConfigType } from '@nestjs/config';
import { JwtPayloadDto } from '../dto/jwt-payload.dto';
import { UserStatus } from '../../../common/models/enums/user-status.enum';

import { User } from '../../users/domain/entities/user.entity';
import { CacheKeys } from '../../../common/utils/cache-keys.factory';
import { RedisService } from '../../../database/redis/redis.service';
import { FindUserByIdUseCase } from '../../users/application/use-cases/find-user-by-id/find-user-by-id.use-case';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly findUserByIdUseCase: FindUserByIdUseCase,
    private readonly redisService: RedisService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfiguration.accessSecret,
      issuer: jwtConfiguration.issuer,
    });
  }

  async validate(payload: JwtPayloadDto): Promise<User> {
    const isBlackListed = await this.redisService.exists(CacheKeys.auth.blackList(payload.jti));

    if (isBlackListed) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.findUserByIdUseCase.execute(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Invalid token: user not found');
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new UnauthorizedException('User is blocked');
    }

    return user;
  }
}
