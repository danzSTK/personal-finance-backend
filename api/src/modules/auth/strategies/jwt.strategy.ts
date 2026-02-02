import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwtConfig from '../../../config/jwt.config';
import type { ConfigType } from '@nestjs/config';
import { JwtPayloadDto } from '../dto/jwt-payload.dto';
import { UserStatus } from '../../../common/models/enums/user-status.enum';
import { UsersService } from '../../users/users.service';
import { User } from '../../users/entities/user.entity';
import { REDIS_CLIENT } from '../../../database/redis/redis.provider';
import Redis from 'ioredis';
import { CacheKeys } from '../../../common/utils/cache-keys.factory';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,

    private readonly userService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfiguration.accessSecret,
      issuer: jwtConfiguration.issuer,
    });
  }

  async validate(payload: JwtPayloadDto): Promise<User> {
    const isBlackListed = await this.redis.exists(CacheKeys.auth.blackList(payload.jti));

    if (isBlackListed) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.userService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Invalid token: user not found');
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new UnauthorizedException('User is blocked');
    }

    return user;
  }
}
