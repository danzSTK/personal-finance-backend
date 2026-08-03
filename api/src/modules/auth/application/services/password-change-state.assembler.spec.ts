import {
  PASSWORD_CHANGE_COMPLETED_WINDOW_MS,
  PASSWORD_CHANGE_FAILURE_WINDOW_MS,
} from '@/modules/auth/domain/constants/password-change.constants';
import { PasswordChangeEvent } from '@/modules/auth/domain/entities/password-change-event.entity';
import { PasswordChangeStateAssembler } from '@/modules/auth/application/services/password-change-state.assembler';
import { randomUUID } from 'node:crypto';

describe('PasswordChangeStateAssembler', () => {
  const assembler = new PasswordChangeStateAssembler();
  const userId = randomUUID();
  const authProviderId = randomUUID();
  const now = new Date('2026-07-30T12:00:00.000Z');

  const context = (occurredAt: Date) => ({
    userId,
    authProviderId,
    occurredAt,
  });

  describe('assemble', () => {
    it('builds the operational state from relevant facts', () => {
      const failed = PasswordChangeEvent.currentPasswordFailed(
        context(new Date(now.getTime() - PASSWORD_CHANGE_FAILURE_WINDOW_MS + 1)),
        randomUUID(),
      );
      const ignoredFailure = PasswordChangeEvent.currentPasswordFailed(
        context(new Date(now.getTime() - PASSWORD_CHANGE_FAILURE_WINDOW_MS)),
        randomUUID(),
      );
      const changed = PasswordChangeEvent.passwordChanged(
        context(new Date(now.getTime() - PASSWORD_CHANGE_COMPLETED_WINDOW_MS + 1)),
        randomUUID(),
      );
      const blockStartedAt = new Date(now.getTime() - 60_000);
      const block = PasswordChangeEvent.failedAttemptsBlockStarted(
        {
          ...context(blockStartedAt),
          blockedUntil: new Date(now.getTime() + 60_000),
        },
        randomUUID(),
      );

      const result = assembler.assemble([ignoredFailure, changed, failed, block], now);

      expect(result.state).toEqual({
        failedAttemptsInWindow: 1,
        blockedUntil: block.blockedUntil,
        lastBlockStartedAt: blockStartedAt,
        completedChangesAt: [changed.occurredAt],
      });
      expect(result.projection.failedAttempts).toEqual([
        {
          eventId: failed.id,
          occurredAt: failed.occurredAt,
        },
      ]);
    });

    it('ignores future events and expired windows', () => {
      const futureFailure = PasswordChangeEvent.currentPasswordFailed(
        context(new Date(now.getTime() + 1)),
        randomUUID(),
      );
      const expiredChange = PasswordChangeEvent.passwordChanged(
        context(new Date(now.getTime() - PASSWORD_CHANGE_COMPLETED_WINDOW_MS)),
        randomUUID(),
      );

      expect(assembler.assemble([futureFailure, expiredChange], now).state).toEqual({
        failedAttemptsInWindow: 0,
        blockedUntil: null,
        lastBlockStartedAt: null,
        completedChangesAt: [],
      });
    });
  });
});
