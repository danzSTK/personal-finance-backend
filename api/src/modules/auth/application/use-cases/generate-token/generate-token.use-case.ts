import { Inject, Injectable } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { type ConfigType } from '@nestjs/config';
import ms, { StringValue } from 'ms';
import { randomUUID } from 'node:crypto';
import jwtConfig from '@/config/jwt.config';
import { ISessionRepository } from '@/modules/auth/domain/repositories/session.repository.interface';
import { type GenerateTokenOutput, type GenerateTokenUseCaseInput } from './generate-token.dto';
import { type JwtPayloadDto } from '@/modules/auth/presentation/dto/jwt-payload.dto';

@Injectable()
export class GenerateTokenUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}

  async execute(data: GenerateTokenUseCaseInput): Promise<GenerateTokenOutput> {
    const { userId, email, status, sessionMetadata } = data;

    const accessTokenPayload: JwtPayloadDto = {
      jti: randomUUID(),
      sub: userId,
      email,
      status,
    };

    const refreshTokenPayload: JwtPayloadDto = {
      jti: randomUUID(),
      sub: userId,
      email,
      status,
    };

    const accessToken = this.jwtService.sign(accessTokenPayload, {
      issuer: this.jwtConfiguration.issuer,
      expiresIn: this.jwtConfiguration.accessExpiresIn,
    } as JwtSignOptions);

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: this.jwtConfiguration.refreshSecret,
      expiresIn: `${this.jwtConfiguration.refreshExpiresIn}`,
    } as JwtSignOptions);

    const ttlSeconds = this.getSeconds(this.jwtConfiguration.refreshExpiresIn as StringValue);

    await this.sessionRepository.createSession(userId, refreshTokenPayload.jti, sessionMetadata, ttlSeconds);

    return { accessToken, refreshToken };
  }

  private getSeconds(time: StringValue | number): number {
    if (typeof time === 'number') {
      return time;
    }

    return Math.floor(ms(time) / 1000);
  }
}
