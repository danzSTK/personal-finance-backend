import { UserSessionsRevokeAllRequestedEvent } from '@/modules/auth/domain/events/user-sessions-revoke-all-requested.event';
import { ISessionRepository } from '@/modules/auth/domain/repositories/session.repository.interface';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class RevokeAllUserSessionsOnRequestedHandler {
  constructor(private readonly sessionRepository: ISessionRepository) {}

  @OnEvent(UserSessionsRevokeAllRequestedEvent.eventName, { suppressErrors: false })
  async handle(event: UserSessionsRevokeAllRequestedEvent): Promise<void> {
    await this.sessionRepository.revokeAllSessions(event.userId);
  }
}
