import { Injectable, UnauthorizedException } from '@nestjs/common';
import { FindUserByIdUseCase } from '../../../../users/application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { ISessionRepository } from '../../../domain/repositories/session.repository.interface';
import { GenerateTokenUseCase } from '../generate-token/generate-token.use-case';
import { type RefreshTokensUseCaseInput } from './refresh-tokens.dto';
import { GenerateTokenOutput } from '../generate-token/generate-token.dto';

@Injectable()
export class RefreshTokensUseCase {
  constructor(
    private readonly findUserByIdUseCase: FindUserByIdUseCase,
    private readonly sessionRepository: ISessionRepository,
    private readonly generateTokenUseCase: GenerateTokenUseCase,
  ) {}

  async execute(data: RefreshTokensUseCaseInput): Promise<GenerateTokenOutput> {
    const { userId, oldJti, sessionMetadata } = data;

    const user = await this.findUserByIdUseCase.execute(userId);

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const storedSession = await this.sessionRepository.getSession(userId, oldJti);

    if (!storedSession) {
      await this.sessionRepository.revokeAllSessions(userId);
      throw new UnauthorizedException('Potential session hijacking');
    }

    await this.sessionRepository.revokeSession(userId, oldJti);

    return this.generateTokenUseCase.execute({
      userId: user.id,
      email: user.email.value,
      status: user.status,
      sessionMetadata,
    });
  }
}
