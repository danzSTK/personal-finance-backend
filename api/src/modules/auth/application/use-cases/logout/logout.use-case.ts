import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type ConfigType } from '@nestjs/config';
import jwtConfig from '@/config/jwt.config';
import { ISessionRepository } from '@/modules/auth/domain/repositories/session.repository.interface';
import { type JwtPayloadDto } from '@/modules/auth/presentation/dto/jwt-payload.dto';
import { type LogoutUseCaseDto } from './logout.dto';

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}

  async execute(data: LogoutUseCaseDto): Promise<boolean> {
    const { userId, accessToken, refreshToken } = data;

    const accessPayload = this.jwtService.decode<JwtPayloadDto>(accessToken);

    if (!accessPayload || !accessPayload.exp) {
      throw new UnauthorizedException('Invalid access token');
    }

    let rtPayload: JwtPayloadDto;

    try {
      rtPayload = this.jwtService.verify<JwtPayloadDto>(refreshToken, {
        secret: this.jwtConfiguration.refreshSecret,
        ignoreExpiration: true,
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalid or expired or not found');
    }

    if (!rtPayload.jti || rtPayload.sub !== userId) {
      throw new UnauthorizedException('Refresh token invalid or expired or not found');
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const remainingTime = accessPayload.exp - currentTime;
    const ttl = remainingTime > 0 ? remainingTime : 1;

    await Promise.all([
      this.sessionRepository.blacklistAccessToken(accessPayload.jti, ttl),
      this.sessionRepository.revokeSession(userId, rtPayload.jti),
    ]);

    return true;
  }
}
