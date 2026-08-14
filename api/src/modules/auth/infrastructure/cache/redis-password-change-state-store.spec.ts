import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { RedisService } from '@/database/redis/redis.service';
import { PasswordChangeStateLoadResultKind } from '@/modules/auth/application/ports/password-change-state-store.interface';
import { RedisPasswordChangeStateStore } from '@/modules/auth/infrastructure/cache/redis-password-change-state-store';

describe('RedisPasswordChangeStateStore', () => {
  const userId = '70a2a29c-8195-48a0-87c1-5fe6b99ef24a';
  const now = new Date('2026-07-30T12:00:00.000Z');
  const evalMock = jest.fn();
  const delMock = jest.fn();
  const redis = {
    getClient: jest.fn(() => ({
      eval: evalMock,
      del: delMock,
    })),
  } as unknown as RedisService;
  const store = new RedisPasswordChangeStateStore(redis);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('load', () => {
    it('maps the MISSING response', async () => {
      evalMock.mockResolvedValue([0]);

      await expect(store.load(userId, now)).resolves.toEqual({
        kind: PasswordChangeStateLoadResultKind.MISSING,
      });
    });

    it('maps PENDING and rounds PTTL up to seconds', async () => {
      evalMock.mockResolvedValue([2, 1_001]);

      await expect(store.load(userId, now)).resolves.toEqual({
        kind: PasswordChangeStateLoadResultKind.PENDING,
        retryAfterSeconds: 2,
      });
    });

    it('maps READY into dates and counters', async () => {
      evalMock.mockResolvedValue([1, now.getTime() + 60_000, now.getTime() - 60_000, 4, now.getTime() - 120_000]);

      await expect(store.load(userId, now)).resolves.toEqual({
        kind: PasswordChangeStateLoadResultKind.READY,
        state: {
          blockedUntil: new Date(now.getTime() + 60_000),
          lastBlockStartedAt: new Date(now.getTime() - 60_000),
          failedAttemptsInWindow: 4,
          completedChangesAt: [new Date(now.getTime() - 120_000)],
        },
      });
    });

    it('rejects malformed responses', async () => {
      evalMock.mockResolvedValue('invalid');

      await expect(store.load(userId, now)).rejects.toThrow('Invalid password change state response');
    });
  });

  describe('beginMutation', () => {
    it('returns an acquired result', async () => {
      evalMock.mockResolvedValue([1, 120_000]);

      await expect(store.beginMutation(userId, 'mutation-token', 120_000)).resolves.toEqual({
        acquired: true,
      });
    });

    it('returns retry information when another owner holds the barrier', async () => {
      evalMock.mockResolvedValue([0, 33_001]);

      await expect(store.beginMutation(userId, 'mutation-token', 120_000)).resolves.toEqual({
        acquired: false,
        retryAfterSeconds: 34,
      });
    });
  });

  describe('clear', () => {
    it('deletes all projection keys for the user', async () => {
      delMock.mockResolvedValue(6);

      await store.clear(userId);

      expect(delMock).toHaveBeenCalledWith(
        CacheKeys.auth.passwordChange.failures(userId),
        CacheKeys.auth.passwordChange.block(userId),
        CacheKeys.auth.passwordChange.blockRecurrence(userId),
        CacheKeys.auth.passwordChange.changes(userId),
        CacheKeys.auth.passwordChange.initialized(userId),
        CacheKeys.auth.passwordChange.pending(userId),
      );
    });
  });
});
