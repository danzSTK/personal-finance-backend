import { PasswordChangeStateSynchronizer } from '@/modules/auth/application/services/password-change-state-synchronizer';
import { PasswordChangeStateRefreshRequestedEvent } from '@/modules/auth/domain/events/password-change-state-refresh-requested.event';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class RefreshPasswordChangeStateOnRequestedHandler {
  constructor(private readonly synchronizer: PasswordChangeStateSynchronizer) {}

  @OnEvent(PasswordChangeStateRefreshRequestedEvent.eventName, { suppressErrors: false })
  async handle(event: PasswordChangeStateRefreshRequestedEvent): Promise<void> {
    await this.synchronizer.synchronize(event.userId, new Date(), event.mutationToken ?? undefined);
  }
}
