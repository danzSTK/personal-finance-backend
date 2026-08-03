import { UserStatus } from '@/common/models/enums/user-status.enum';
import { AuthRequest } from '@/common/models/interfaces/auth-request.interface';
import jwtConfig from '@/config/jwt.config';
import { ISessionRepository } from '@/modules/auth/domain/repositories/session.repository.interface';
import { type JwtPayloadDto } from '@/modules/auth/presentation/dto/jwt-payload.dto';
import { FindUserByIdUseCase } from '@/modules/users/application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { User } from '@/modules/users/domain/entities/user.entity';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly findUserByIdUseCase: FindUserByIdUseCase,
    private readonly userRepository: IUserRepository,
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
      passReqToCallback: true,
    });
  }

  async validate(request: AuthRequest, payload: JwtPayloadDto): Promise<User> {
    if (!payload.jti) {
      throw new UnauthorizedException('Token identifier (jti) missing');
    }

    const isBlacklisted = await this.sessionRepository.isAccessTokenBlacklisted(payload.jti);

    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const credentialVersion = await this.userRepository.findCredentialVersionById(payload.sub);

    if (credentialVersion === null || (payload.credentialVersion ?? 1) !== credentialVersion) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.findUserByIdUseCase.execute(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Invalid token: user not found');
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new UnauthorizedException('User is blocked');
    }

    request.authToken = payload;
    return user;
  }
}
