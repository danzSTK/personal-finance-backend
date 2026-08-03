/* eslint-disable @typescript-eslint/unbound-method */
import { RefreshPasswordChangeStateOnRequestedHandler } from '@/modules/auth/application/handlers/refresh-password-change-state-on-requested.handler';
import { RevokeAllUserSessionsOnRequestedHandler } from '@/modules/auth/application/handlers/revoke-all-user-sessions-on-requested.handler';
import { PasswordChangeStateSynchronizer } from '@/modules/auth/application/services/password-change-state-synchronizer';
import { PasswordChangeStateRefreshRequestedEvent } from '@/modules/auth/domain/events/password-change-state-refresh-requested.event';
import { UserSessionsRevokeAllRequestedEvent } from '@/modules/auth/domain/events/user-sessions-revoke-all-requested.event';
import { ISessionRepository } from '@/modules/auth/domain/repositories/session.repository.interface';
import { randomUUID } from 'node:crypto';

describe('Password change worker handlers', () => {
  const userId = randomUUID();
  const sourceEventId = randomUUID();
  const occurredAt = new Date('2026-07-30T12:00:00.000Z');

  describe('RefreshPasswordChangeStateOnRequestedHandler', () => {
    it('rebuilds the current projection and passes the mutation owner token', async () => {
      const mutationToken = randomUUID();
      const synchronizer = {
        synchronize: jest.fn(),
      } as unknown as jest.Mocked<PasswordChangeStateSynchronizer>;
      const handler = new RefreshPasswordChangeStateOnRequestedHandler(synchronizer);
      const event = PasswordChangeStateRefreshRequestedEvent.create(userId, sourceEventId, occurredAt, mutationToken);

      await handler.handle(event);

      expect(synchronizer.synchronize).toHaveBeenCalledWith(userId, expect.any(Date), mutationToken);
    });
  });

  describe('RevokeAllUserSessionsOnRequestedHandler', () => {
    it('delegates idempotent physical cleanup to the session repository', async () => {
      const sessionRepository = {
        revokeAllSessions: jest.fn(),
      } as unknown as jest.Mocked<ISessionRepository>;
      const handler = new RevokeAllUserSessionsOnRequestedHandler(sessionRepository);
      const event = UserSessionsRevokeAllRequestedEvent.create(userId, sourceEventId, occurredAt);

      await handler.handle(event);

      expect(sessionRepository.revokeAllSessions).toHaveBeenCalledWith(userId);
    });
  });
});
