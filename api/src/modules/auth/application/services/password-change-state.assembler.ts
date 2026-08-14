import {
  PasswordChangeProjectionEntry,
  PasswordChangeStateProjection,
} from '@/modules/auth/application/ports/password-change-state-store.interface';
import {
  PASSWORD_CHANGE_BLOCK_RECURRENCE_WINDOW_MS,
  PASSWORD_CHANGE_COMPLETED_WINDOW_MS,
  PASSWORD_CHANGE_FAILURE_WINDOW_MS,
  PasswordChangeEventType,
} from '@/modules/auth/domain/constants/password-change.constants';
import { PasswordChangeEvent } from '@/modules/auth/domain/entities/password-change-event.entity';
import { PasswordChangeState } from '@/modules/auth/domain/policies/change-password.policy';

export interface AssembledPasswordChangeState {
  readonly state: PasswordChangeState;
  readonly projection: PasswordChangeStateProjection;
}

export class PasswordChangeStateAssembler {
  assemble(events: ReadonlyArray<PasswordChangeEvent>, now: Date): AssembledPasswordChangeState {
    const failureWindowStartsAt = new Date(now.getTime() - PASSWORD_CHANGE_FAILURE_WINDOW_MS);

    const completedWindowStartsAt = new Date(now.getTime() - PASSWORD_CHANGE_COMPLETED_WINDOW_MS);

    const recurrenceWindowStartsAt = new Date(now.getTime() - PASSWORD_CHANGE_BLOCK_RECURRENCE_WINDOW_MS);

    const failedAttempts = events
      .filter(
        event =>
          event.eventType === PasswordChangeEventType.CURRENT_PASSWORD_FAILED &&
          event.occurredAt > failureWindowStartsAt &&
          event.occurredAt <= now,
      )
      .map(event => this.toProjectionEntry(event));

    const completedChanges = events
      .filter(
        event =>
          event.eventType === PasswordChangeEventType.PASSWORD_CHANGED &&
          event.occurredAt > completedWindowStartsAt &&
          event.occurredAt <= now,
      )
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
      .map(event => this.toProjectionEntry(event));

    const blockEvents = events
      .filter(event => event.eventType === PasswordChangeEventType.FAILED_ATTEMPTS_BLOCK_STARTED)
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());

    const activeBlock = blockEvents
      .filter(event => event.blockedUntil !== null && event.blockedUntil > now)
      .sort((left, right) => (right.blockedUntil?.getTime() ?? 0) - (left.blockedUntil?.getTime() ?? 0))[0];

    const lastRelevantBlock = blockEvents.find(
      event => event.occurredAt > recurrenceWindowStartsAt && event.occurredAt <= now,
    );

    const state: PasswordChangeState = {
      failedAttemptsInWindow: failedAttempts.length,
      blockedUntil: activeBlock?.blockedUntil ?? null,
      lastBlockStartedAt: lastRelevantBlock?.occurredAt ?? null,
      completedChangesAt: completedChanges.map(entry => new Date(entry.occurredAt)),
    };

    return {
      state,
      projection: {
        failedAttempts,
        completedChanges,
        blockedUntil: state.blockedUntil,
        lastBlockStartedAt: state.lastBlockStartedAt,
      },
    };
  }

  private toProjectionEntry(event: PasswordChangeEvent): PasswordChangeProjectionEntry {
    return {
      eventId: event.id,
      occurredAt: event.occurredAt,
    };
  }
}
