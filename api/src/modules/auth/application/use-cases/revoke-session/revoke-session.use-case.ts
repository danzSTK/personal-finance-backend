import { Injectable } from '@nestjs/common';
import { ISessionRepository } from '@/modules/auth/domain/repositories/session.repository.interface';
import { type RevokeSessionUseCaseDto } from './revoke-session.dto';
import { SessionNotFoundError } from '@/modules/auth/application/errors';

@Injectable()
export class RevokeSessionUseCase {
  constructor(private readonly sessionRepository: ISessionRepository) {}

  async execute(data: RevokeSessionUseCaseDto): Promise<void> {
    const { userId, jti } = data;

    const exists = await this.sessionRepository.sessionExists(userId, jti);

    if (!exists) {
      throw new SessionNotFoundError();
    }

    await this.sessionRepository.revokeSession(userId, jti);
  }
}
