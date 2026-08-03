import { PasswordChangeEventType } from '@/modules/auth/domain/constants/password-change.constants';
import { PasswordChangeEvent } from '@/modules/auth/domain/entities/password-change-event.entity';
import { InvalidPasswordChangeEventError } from '@/modules/auth/domain/errors/invalid-password-change-event.error';
import { randomUUID } from 'node:crypto';

describe('PasswordChangeEvent', () => {
  const occurredAt = new Date('2026-07-30T12:00:00.000Z');
  const context = () => ({
    userId: randomUUID(),
    authProviderId: randomUUID(),
    sessionId: randomUUID(),
    ipAddress: '2001:db8::1',
    userAgent: 'Test Browser',
    metadata: {
      location: 'Fortaleza, CE, BR',
      browser: 'Test Browser 1',
      operatingSystem: 'Test OS',
      device: 'Desktop',
    },
    occurredAt,
  });

  describe('factories', () => {
    it('creates a current-password failure without blockedUntil', () => {
      const event = PasswordChangeEvent.currentPasswordFailed(context(), randomUUID());

      expect(event.eventType).toBe(PasswordChangeEventType.CURRENT_PASSWORD_FAILED);
      expect(event.blockedUntil).toBeNull();
      expect(event.isFailedAttempt).toBe(true);
    });

    it('creates a completed password change', () => {
      const event = PasswordChangeEvent.passwordChanged(context(), randomUUID());

      expect(event.eventType).toBe(PasswordChangeEventType.PASSWORD_CHANGED);
      expect(event.isPasswordChanged).toBe(true);
    });

    it('creates a block only when blockedUntil is after occurredAt', () => {
      const blockedUntil = new Date(occurredAt.getTime() + 60_000);
      const event = PasswordChangeEvent.failedAttemptsBlockStarted(
        {
          ...context(),
          blockedUntil,
        },
        randomUUID(),
      );

      expect(event.eventType).toBe(PasswordChangeEventType.FAILED_ATTEMPTS_BLOCK_STARTED);
      expect(event.blockedUntil).toEqual(blockedUntil);
      expect(event.isBlockActiveAt(occurredAt)).toBe(true);
    });
  });

  describe('validation', () => {
    it('rejects blockedUntil on a non-block event', () => {
      expect(() =>
        PasswordChangeEvent.create(
          {
            ...context(),
            eventType: PasswordChangeEventType.PASSWORD_CHANGED,
            blockedUntil: new Date(occurredAt.getTime() + 60_000),
            createdAt: occurredAt,
          },
          randomUUID(),
        ),
      ).toThrow(InvalidPasswordChangeEventError);
    });

    it('rejects an invalid IP address', () => {
      expect(() =>
        PasswordChangeEvent.currentPasswordFailed(
          {
            ...context(),
            ipAddress: 'not-an-ip',
          },
          randomUUID(),
        ),
      ).toThrow(InvalidPasswordChangeEventError);
    });

    it('rejects metadata keys outside the allowlist', () => {
      expect(() =>
        PasswordChangeEvent.currentPasswordFailed(
          {
            ...context(),
            metadata: {
              password: 'must-not-be-persisted',
            } as unknown as { browser: string },
          },
          randomUUID(),
        ),
      ).toThrow(InvalidPasswordChangeEventError);
    });

    it('rejects metadata values above the configured limit', () => {
      expect(() =>
        PasswordChangeEvent.currentPasswordFailed(
          {
            ...context(),
            metadata: {
              browser: 'x'.repeat(257),
            },
          },
          randomUUID(),
        ),
      ).toThrow(InvalidPasswordChangeEventError);
    });

    it('defensively copies dates and metadata', () => {
      const input = context();
      const expectedOccurredAt = new Date(input.occurredAt);
      const event = PasswordChangeEvent.passwordChanged(input, randomUUID());

      input.occurredAt.setUTCFullYear(2030);
      (input.metadata as { browser: string }).browser = 'Changed';

      expect(event.occurredAt).toEqual(expectedOccurredAt);
      expect(event.metadata.browser).toBe('Test Browser 1');
    });
  });
});
