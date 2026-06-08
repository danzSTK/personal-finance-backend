import { Injectable } from '@nestjs/common';
import { FindUserByIdUseCase } from '@/modules/users/application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { ISessionRepository } from '@/modules/auth/domain/repositories/session.repository.interface';
import { GenerateTokenUseCase } from '../generate-token/generate-token.use-case';
import { type RefreshTokensUseCaseInput } from './refresh-tokens.dto';
import { GenerateTokenOutput } from '../generate-token/generate-token.dto';
import { InvalidRefreshTokenError, PotentialSessionHijackingError } from '@/modules/auth/application/errors';

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
      throw new InvalidRefreshTokenError();
    }

    const storedSession = await this.sessionRepository.getSession(userId, oldJti);

    if (!storedSession) {
      await this.sessionRepository.revokeAllSessions(userId);
      throw new PotentialSessionHijackingError();
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
