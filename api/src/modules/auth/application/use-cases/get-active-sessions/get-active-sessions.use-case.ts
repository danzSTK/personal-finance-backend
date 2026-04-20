import { Injectable } from '@nestjs/common';
import { type ActiveSession } from '@/common/models/interfaces';
import { ISessionRepository } from '@/modules/auth/domain/repositories/session.repository.interface';

@Injectable()
export class GetActiveSessionsUseCase {
  constructor(private readonly sessionRepository: ISessionRepository) {}

  async execute(userId: string, currentSessionJti: string): Promise<ActiveSession[]> {
    return this.sessionRepository.getActiveSessions(userId, currentSessionJti);
  }
}
