import {
  PASSWORD_CHANGE_BLOCK_RECURRENCE_WINDOW_MS,
  PASSWORD_CHANGE_COMPLETED_LIMIT,
  PASSWORD_CHANGE_COMPLETED_WINDOW_MS,
  PASSWORD_CHANGE_COOLDOWN_MS,
  PASSWORD_CHANGE_FAILED_ATTEMPTS_LIMIT,
  PASSWORD_CHANGE_FIRST_BLOCK_DURATION_MS,
  PASSWORD_CHANGE_RECURRENT_BLOCK_DURATION_MS,
} from '@/modules/auth/domain/constants/password-change.constants';

export const PasswordChangeRestrictionReason = {
  FAILED_ATTEMPTS_BLOCK: 'FAILED_ATTEMPTS_BLOCK',
  COOLDOWN: 'COOLDOWN',
  DAILY_LIMIT: 'DAILY_LIMIT',
} as const;

export type PasswordChangeRestrictionReason =
  (typeof PasswordChangeRestrictionReason)[keyof typeof PasswordChangeRestrictionReason];

export interface PasswordChangeState {
  readonly failedAttemptsInWindow: number;
  readonly blockedUntil: Date | null;
  readonly lastBlockStartedAt: Date | null;
  readonly completedChangesAt: ReadonlyArray<Date>;
}

export type PasswordChangePolicyDecision =
  | {
      readonly allowed: true;
    }
  | {
      readonly allowed: false;
      readonly reason: PasswordChangeRestrictionReason;
      readonly retryAt: Date;
      readonly retryAfterSeconds: number;
    };

export type FailedPasswordAttemptDecision =
  | {
      readonly shouldStartBlock: false;
    }
  | {
      readonly shouldStartBlock: true;
      readonly blockedUntil: Date;
    };

export class ChangePasswordPolicy {
  evaluateRestrictions(state: PasswordChangeState, now: Date): PasswordChangePolicyDecision {
    const restrictions: Array<Exclude<PasswordChangePolicyDecision, { allowed: true }>> = [];

    if (state.blockedUntil && state.blockedUntil > now) {
      restrictions.push(this.deny(PasswordChangeRestrictionReason.FAILED_ATTEMPTS_BLOCK, state.blockedUntil, now));
    }

    const completedChanges = [...state.completedChangesAt]
      .filter(occurredAt => occurredAt > this.subtract(now, PASSWORD_CHANGE_COMPLETED_WINDOW_MS))
      .sort((left, right) => right.getTime() - left.getTime());

    const lastChange = completedChanges[0];

    if (lastChange) {
      const cooldownUntil = this.add(lastChange, PASSWORD_CHANGE_COOLDOWN_MS);

      if (cooldownUntil > now) {
        restrictions.push(this.deny(PasswordChangeRestrictionReason.COOLDOWN, cooldownUntil, now));
      }
    }

    if (completedChanges.length >= PASSWORD_CHANGE_COMPLETED_LIMIT) {
      const limitingChange = completedChanges[PASSWORD_CHANGE_COMPLETED_LIMIT - 1];

      restrictions.push(
        this.deny(
          PasswordChangeRestrictionReason.DAILY_LIMIT,
          this.add(limitingChange, PASSWORD_CHANGE_COMPLETED_WINDOW_MS),
          now,
        ),
      );
    }

    if (restrictions.length === 0) {
      return {
        allowed: true,
      };
    }

    return restrictions.reduce((current, restriction) =>
      restriction.retryAt > current.retryAt ? restriction : current,
    );
  }

  evaluateFailedAttempts(state: PasswordChangeState, failedAt: Date): FailedPasswordAttemptDecision {
    const failuresIncludingCurrent = state.failedAttemptsInWindow + 1;

    if (failuresIncludingCurrent < PASSWORD_CHANGE_FAILED_ATTEMPTS_LIMIT) {
      return {
        shouldStartBlock: false,
      };
    }

    const recurrenceWindowStartsAt = this.subtract(failedAt, PASSWORD_CHANGE_BLOCK_RECURRENCE_WINDOW_MS);

    const hasRecentBlock =
      state.lastBlockStartedAt !== null &&
      state.lastBlockStartedAt > recurrenceWindowStartsAt &&
      state.lastBlockStartedAt <= failedAt;

    const duration = hasRecentBlock
      ? PASSWORD_CHANGE_RECURRENT_BLOCK_DURATION_MS
      : PASSWORD_CHANGE_FIRST_BLOCK_DURATION_MS;

    return {
      shouldStartBlock: true,
      blockedUntil: this.add(failedAt, duration),
    };
  }

  private deny(
    reason: PasswordChangeRestrictionReason,
    retryAt: Date,
    now: Date,
  ): Exclude<PasswordChangePolicyDecision, { allowed: true }> {
    return {
      allowed: false,
      reason,
      retryAt: new Date(retryAt),
      retryAfterSeconds: Math.max(1, Math.ceil((retryAt.getTime() - now.getTime()) / 1_000)),
    };
  }

  private add(date: Date, milliseconds: number): Date {
    return new Date(date.getTime() + milliseconds);
  }

  private subtract(date: Date, milliseconds: number): Date {
    return new Date(date.getTime() - milliseconds);
  }
}
