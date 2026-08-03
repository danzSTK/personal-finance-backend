import { PasswordChangeBlockStartedEvent } from '@/modules/auth/domain/events/password-change-block-started.event';
import { PasswordChangeStateRefreshRequestedEvent } from '@/modules/auth/domain/events/password-change-state-refresh-requested.event';
import { PasswordChangedEvent } from '@/modules/auth/domain/events/password-changed.event';
import { UserSessionsRevokeAllRequestedEvent } from '@/modules/auth/domain/events/user-sessions-revoke-all-requested.event';
import { PasswordChangeBlockStartedEventRehydrator } from '@/modules/auth/infrastructure/events/password-change-block-started-event.rehydrator';
import { PasswordChangeStateRefreshRequestedEventRehydrator } from '@/modules/auth/infrastructure/events/password-change-state-refresh-requested-event.rehydrator';
import { PasswordChangedEventRehydrator } from '@/modules/auth/infrastructure/events/password-changed-event.rehydrator';
import { UserSessionsRevokeAllRequestedEventRehydrator } from '@/modules/auth/infrastructure/events/user-sessions-revoke-all-requested-event.rehydrator';
import { randomUUID } from 'node:crypto';

describe('Password change event rehydrators', () => {
  const userId = randomUUID();
  const sourceEventId = randomUUID();
  const occurredAt = new Date('2026-07-30T12:00:00.000Z');
  const securityContext = {
    ipAddress: '203.0.113.10',
    location: 'Fortaleza',
    browser: 'Browser',
    operatingSystem: 'OS',
    device: 'Desktop',
  };
  const input = (payload: unknown) => ({
    aggregateId: userId,
    occurredAt,
    metadata: {},
    payload,
  });

  describe('rehydrate', () => {
    it('rehydrates state refresh', () => {
      const mutationToken = randomUUID();
      const event = new PasswordChangeStateRefreshRequestedEventRehydrator().rehydrate(
        input({
          userId,
          sourceEventId,
          mutationToken,
        }),
      );

      expect(event).toBeInstanceOf(PasswordChangeStateRefreshRequestedEvent);
      expect(event.mutationToken).toBe(mutationToken);
    });

    it('rehydrates password changed', () => {
      const event = new PasswordChangedEventRehydrator().rehydrate(
        input({
          userId,
          sourceEventId,
          securityContext,
        }),
      );

      expect(event).toBeInstanceOf(PasswordChangedEvent);
      expect(event.occurredAt).toEqual(occurredAt);
    });

    it('rehydrates a block start with its end instant', () => {
      const blockedUntil = '2026-07-30T13:00:00.000Z';
      const event = new PasswordChangeBlockStartedEventRehydrator().rehydrate(
        input({
          userId,
          sourceEventId,
          blockedUntil,
          securityContext,
        }),
      );

      expect(event).toBeInstanceOf(PasswordChangeBlockStartedEvent);
      expect(event.blockedUntil).toEqual(new Date(blockedUntil));
    });

    it('rehydrates session cleanup', () => {
      const event = new UserSessionsRevokeAllRequestedEventRehydrator().rehydrate(
        input({
          userId,
          sourceEventId,
        }),
      );

      expect(event).toBeInstanceOf(UserSessionsRevokeAllRequestedEvent);
    });

    it('rejects unexpected sensitive fields', () => {
      expect(() =>
        new PasswordChangedEventRehydrator().rehydrate(
          input({
            userId,
            sourceEventId,
            securityContext,
            password: 'must-not-pass',
          }),
        ),
      ).toThrow();
    });
  });
});
