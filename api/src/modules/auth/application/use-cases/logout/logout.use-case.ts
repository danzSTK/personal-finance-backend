import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ISessionRepository } from '../../../domain/repositories/session.repository.interface';
import { type JwtPayloadDto } from '../../../presentation/dto/jwt-payload.dto';
import { type LogoutUseCaseDto } from './logout.dto';

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(data: LogoutUseCaseDto): Promise<boolean> {
    const { userId, accessToken, refreshToken } = data;

    const accessPayload = this.jwtService.decode<JwtPayloadDto>(accessToken);

    if (!accessPayload || !accessPayload.exp) {
      throw new UnauthorizedException('Invalid access token');
    }

    const rtPayload = this.jwtService.decode<JwtPayloadDto>(refreshToken);

    if (!rtPayload || !rtPayload.jti) {
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
