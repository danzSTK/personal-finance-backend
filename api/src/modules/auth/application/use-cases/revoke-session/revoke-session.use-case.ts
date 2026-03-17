import { Injectable, NotFoundException } from '@nestjs/common';
import { ISessionRepository } from '../../../domain/repositories/session.repository.interface';
import { type RevokeSessionUseCaseDto } from './revoke-session.dto';

@Injectable()
export class RevokeSessionUseCase {
  constructor(private readonly sessionRepository: ISessionRepository) {}

  async execute(data: RevokeSessionUseCaseDto): Promise<void> {
    const { userId, jti } = data;

    const exists = await this.sessionRepository.sessionExists(userId, jti);

    if (!exists) {
      throw new NotFoundException('Session not found');
    }

    await this.sessionRepository.revokeSession(userId, jti);
  }
}
