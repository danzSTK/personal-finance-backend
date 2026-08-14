import {
  PASSWORD_CHANGE_COMPLETED_WINDOW_MS,
  PASSWORD_CHANGE_COOLDOWN_MS,
  PASSWORD_CHANGE_FIRST_BLOCK_DURATION_MS,
  PASSWORD_CHANGE_RECURRENT_BLOCK_DURATION_MS,
} from '@/modules/auth/domain/constants/password-change.constants';
import {
  ChangePasswordPolicy,
  PasswordChangeRestrictionReason,
  PasswordChangeState,
} from '@/modules/auth/domain/policies/change-password.policy';

describe('ChangePasswordPolicy', () => {
  const policy = new ChangePasswordPolicy();
  const now = new Date('2026-07-30T12:00:00.000Z');

  const state = (overrides: Partial<PasswordChangeState> = {}): PasswordChangeState => ({
    failedAttemptsInWindow: 0,
    blockedUntil: null,
    lastBlockStartedAt: null,
    completedChangesAt: [],
    ...overrides,
  });

  describe('evaluateRestrictions', () => {
    it('allows the operation when no restriction is active', () => {
      expect(policy.evaluateRestrictions(state(), now)).toEqual({ allowed: true });
    });

    it('rejects an active failed-attempt block with a rounded retry time', () => {
      const blockedUntil = new Date(now.getTime() + 60_001);

      expect(policy.evaluateRestrictions(state({ blockedUntil }), now)).toEqual({
        allowed: false,
        reason: PasswordChangeRestrictionReason.FAILED_ATTEMPTS_BLOCK,
        retryAt: blockedUntil,
        retryAfterSeconds: 61,
      });
    });

    it('does not reject a block ending exactly now', () => {
      expect(policy.evaluateRestrictions(state({ blockedUntil: now }), now)).toEqual({ allowed: true });
    });

    it('rejects during the ten-minute cooldown', () => {
      const changedAt = new Date(now.getTime() - PASSWORD_CHANGE_COOLDOWN_MS + 1_000);

      expect(policy.evaluateRestrictions(state({ completedChangesAt: [changedAt] }), now)).toEqual({
        allowed: false,
        reason: PasswordChangeRestrictionReason.COOLDOWN,
        retryAt: new Date(changedAt.getTime() + PASSWORD_CHANGE_COOLDOWN_MS),
        retryAfterSeconds: 1,
      });
    });

    it('rejects the fourth change in a rolling 24-hour window', () => {
      const completedChangesAt = [
        new Date(now.getTime() - 60 * 60_000),
        new Date(now.getTime() - 2 * 60 * 60_000),
        new Date(now.getTime() - 3 * 60 * 60_000),
      ];

      const decision = policy.evaluateRestrictions(state({ completedChangesAt }), now);

      expect(decision).toEqual({
        allowed: false,
        reason: PasswordChangeRestrictionReason.DAILY_LIMIT,
        retryAt: new Date(completedChangesAt[2].getTime() + PASSWORD_CHANGE_COMPLETED_WINDOW_MS),
        retryAfterSeconds: 21 * 60 * 60,
      });
    });

    it('selects the restriction with the latest retry time', () => {
      const blockedUntil = new Date(now.getTime() + 30 * 60_000);
      const completedChangesAt = [
        new Date(now.getTime() - 11 * 60_000),
        new Date(now.getTime() - 2 * 60 * 60_000),
        new Date(now.getTime() - 3 * 60 * 60_000),
      ];

      const decision = policy.evaluateRestrictions(state({ blockedUntil, completedChangesAt }), now);

      expect(decision.allowed).toBe(false);
      if (decision.allowed) {
        throw new Error('Expected a restriction');
      }
      expect(decision.reason).toBe(PasswordChangeRestrictionReason.DAILY_LIMIT);
    });

    it('ignores changes exactly at the rolling-window boundary', () => {
      const completedChangesAt = [
        new Date(now.getTime() - PASSWORD_CHANGE_COMPLETED_WINDOW_MS),
        new Date(now.getTime() - PASSWORD_CHANGE_COMPLETED_WINDOW_MS),
        new Date(now.getTime() - PASSWORD_CHANGE_COMPLETED_WINDOW_MS),
      ];

      expect(policy.evaluateRestrictions(state({ completedChangesAt }), now)).toEqual({ allowed: true });
    });
  });

  describe('evaluateFailedAttempts', () => {
    it('does not start a block before the fifth failure', () => {
      expect(policy.evaluateFailedAttempts(state({ failedAttemptsInWindow: 3 }), now)).toEqual({
        shouldStartBlock: false,
      });
    });

    it('starts a one-hour block on the fifth failure', () => {
      expect(policy.evaluateFailedAttempts(state({ failedAttemptsInWindow: 4 }), now)).toEqual({
        shouldStartBlock: true,
        blockedUntil: new Date(now.getTime() + PASSWORD_CHANGE_FIRST_BLOCK_DURATION_MS),
      });
    });

    it('starts a 24-hour block when a prior block began inside the recurrence window', () => {
      const lastBlockStartedAt = new Date(now.getTime() - 23 * 60 * 60_000);

      expect(
        policy.evaluateFailedAttempts(
          state({
            failedAttemptsInWindow: 4,
            lastBlockStartedAt,
          }),
          now,
        ),
      ).toEqual({
        shouldStartBlock: true,
        blockedUntil: new Date(now.getTime() + PASSWORD_CHANGE_RECURRENT_BLOCK_DURATION_MS),
      });
    });

    it('uses the one-hour duration when recurrence begins exactly at the boundary', () => {
      const lastBlockStartedAt = new Date(now.getTime() - PASSWORD_CHANGE_COMPLETED_WINDOW_MS);

      expect(
        policy.evaluateFailedAttempts(
          state({
            failedAttemptsInWindow: 4,
            lastBlockStartedAt,
          }),
          now,
        ),
      ).toEqual({
        shouldStartBlock: true,
        blockedUntil: new Date(now.getTime() + PASSWORD_CHANGE_FIRST_BLOCK_DURATION_MS),
      });
    });
  });
});
