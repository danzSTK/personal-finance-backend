import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { type ConfigType } from '@nestjs/config';
import jwtConfig from '@/config/jwt.config';
import { UserStatus } from '@/common/models/enums/user-status.enum';
import { User } from '@/modules/users/domain/entities/user.entity';
import { FindUserByIdUseCase } from '@/modules/users/application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { ISessionRepository } from '@/modules/auth/domain/repositories/session.repository.interface';
import { type JwtPayloadDto } from '@/modules/auth/presentation/dto/jwt-payload.dto';
import { AuthRequest } from '@/common/models/interfaces/auth-request.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly findUserByIdUseCase: FindUserByIdUseCase,
    private readonly sessionRepository: ISessionRepository,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {
    super({
      jwtFromRequest: (request: AuthRequest) => {
        const token = request?.cookies?.accessToken;

        if (!token || typeof token !== 'string' || token.trim() === '') {
          return null;
        }

        return token;
      },
      ignoreExpiration: false,
      secretOrKey: jwtConfiguration.accessSecret,
      issuer: jwtConfiguration.issuer,
    });
  }

  async validate(payload: JwtPayloadDto): Promise<User> {
    if (!payload.jti) {
      throw new UnauthorizedException('Token identifier (jti) missing');
    }

    const isBlacklisted = await this.sessionRepository.isAccessTokenBlacklisted(payload.jti);

    if (isBlacklisted) {
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
