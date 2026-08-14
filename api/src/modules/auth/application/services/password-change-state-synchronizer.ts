import { IPasswordChangeStateStore } from '@/modules/auth/application/ports/password-change-state-store.interface';
import { PasswordChangeStateAssembler } from '@/modules/auth/application/services/password-change-state.assembler';
import {
  PASSWORD_CHANGE_BLOCK_RECURRENCE_WINDOW_MS,
  PASSWORD_CHANGE_COMPLETED_WINDOW_MS,
  PASSWORD_CHANGE_RECURRENT_BLOCK_DURATION_MS,
} from '@/modules/auth/domain/constants/password-change.constants';
import { IPasswordChangeEventRepository } from '@/modules/auth/domain/repositories/password-change-event.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PasswordChangeStateSynchronizer {
  constructor(
    private readonly eventRepository: IPasswordChangeEventRepository,
    private readonly stateStore: IPasswordChangeStateStore,
    private readonly assembler: PasswordChangeStateAssembler,
  ) {}

  async synchronize(userId: string, now = new Date(), mutationToken?: string): Promise<void> {
    const lookbackMs = Math.max(
      PASSWORD_CHANGE_COMPLETED_WINDOW_MS,
      PASSWORD_CHANGE_BLOCK_RECURRENCE_WINDOW_MS,
      PASSWORD_CHANGE_RECURRENT_BLOCK_DURATION_MS,
    );

    const events = await this.eventRepository.findRelevantEvents(userId, new Date(now.getTime() - lookbackMs));

    const assembled = this.assembler.assemble(events, now);

    await this.stateStore.replace(userId, assembled.projection, now, mutationToken);
  }
}
