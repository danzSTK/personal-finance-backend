import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { PasswordChangeOperationPendingError } from '@/modules/auth/application/errors/password-change-operation-pending.error';
import { PasswordChangeStateUnavailableError } from '@/modules/auth/application/errors/password-change-state-unavailable.error';
import {
  IPasswordChangeStateStore,
  PasswordChangeStateLoadResult,
  PasswordChangeStateLoadResultKind,
} from '@/modules/auth/application/ports/password-change-state-store.interface';
import { PasswordChangeStateAssembler } from '@/modules/auth/application/services/password-change-state.assembler';
import {
  PASSWORD_CHANGE_BLOCK_RECURRENCE_WINDOW_MS,
  PASSWORD_CHANGE_COMPLETED_WINDOW_MS,
  PASSWORD_CHANGE_RECURRENT_BLOCK_DURATION_MS,
} from '@/modules/auth/domain/constants/password-change.constants';
import { PasswordChangeEvent } from '@/modules/auth/domain/entities/password-change-event.entity';
import { PasswordChangeState } from '@/modules/auth/domain/policies/change-password.policy';
import { IPasswordChangeEventRepository } from '@/modules/auth/domain/repositories/password-change-event.repository.interface';
import { Injectable, Logger } from '@nestjs/common';

export interface OperationalPasswordChangeState {
  readonly state: PasswordChangeState;
}

@Injectable()
export class PasswordChangeStateLoader {
  private readonly logger = new Logger(PasswordChangeStateLoader.name);

  constructor(
    private readonly stateStore: IPasswordChangeStateStore,
    private readonly eventRepository: IPasswordChangeEventRepository,
    private readonly assembler: PasswordChangeStateAssembler,
  ) {}

  async load(userId: string, now: Date, options?: IRepositoryOptions): Promise<OperationalPasswordChangeState> {
    let result: PasswordChangeStateLoadResult;

    try {
      result = await this.stateStore.load(userId, now);
    } catch {
      this.logger.warn('Password change Redis State is unavailable; failing closed');

      throw new PasswordChangeStateUnavailableError();
    }

    if (result.kind === PasswordChangeStateLoadResultKind.READY) {
      return {
        state: result.state,
      };
    }

    if (result.kind === PasswordChangeStateLoadResultKind.PENDING) {
      throw new PasswordChangeOperationPendingError(result.retryAfterSeconds);
    }

    return this.hydrate(userId, now, options);
  }

  private async hydrate(
    userId: string,
    now: Date,
    options?: IRepositoryOptions,
  ): Promise<OperationalPasswordChangeState> {
    const events = await this.loadEvents(userId, now, options);
    const assembled = this.assembler.assemble(events, now);

    try {
      await this.stateStore.replace(userId, assembled.projection, now);
    } catch {
      throw new PasswordChangeStateUnavailableError();
    }

    return {
      state: assembled.state,
    };
  }

  private async loadEvents(
    userId: string,
    now: Date,
    options?: IRepositoryOptions,
  ): Promise<ReadonlyArray<PasswordChangeEvent>> {
    const lookbackMs = Math.max(
      PASSWORD_CHANGE_COMPLETED_WINDOW_MS,
      PASSWORD_CHANGE_BLOCK_RECURRENCE_WINDOW_MS,
      PASSWORD_CHANGE_RECURRENT_BLOCK_DURATION_MS,
    );

    return this.eventRepository.findRelevantEvents(userId, new Date(now.getTime() - lookbackMs), options);
  }
}
