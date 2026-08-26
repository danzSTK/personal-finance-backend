import { RedisService } from '@/database/redis/redis.service';
import {
  EmailVerificationChallengeOrigin,
  EmailVerificationResendMutationKind,
  EmailVerificationResendRestriction,
  EmailVerificationResendStatus,
} from '@/modules/auth/domain/constants/email-verification.constants';
import { RedisEmailVerificationResendStateStore } from '@/modules/auth/infrastructure/cache/redis-email-verification-resend-state-store';

describe('RedisEmailVerificationResendStateStore', () => {
  let evalScript: jest.Mock;
  let store: RedisEmailVerificationResendStateStore;

  beforeEach(() => {
    evalScript = jest.fn();
    const redis = {
      getClient: () => ({ eval: evalScript }),
    } as unknown as RedisService;
    store = new RedisEmailVerificationResendStateStore(redis);
    jest.clearAllMocks();
  });

  describe('load', () => {
    it('treats absent keys as an available empty state', async () => {
      evalScript.mockResolvedValue([0, 0, 5, '']);

      await expect(store.load('user-1', new Date('2026-08-26T00:00:00.000Z'))).resolves.toEqual({
        kind: EmailVerificationResendStatus.AVAILABLE,
        manualResendsUsed: 0,
        manualResendsRemaining: 5,
        lastLogicalSendAt: null,
      });
    });

    it('parses a blocked state and rounds PTTL up', async () => {
      evalScript.mockResolvedValue([
        1,
        1,
        90_001,
        2,
        3,
        JSON.stringify({
          challengeId: 'challenge-1',
          origin: EmailVerificationChallengeOrigin.MANUAL_RESEND,
          logicalSendAtMs: Date.parse('2026-08-26T00:00:00.000Z'),
        }),
      ]);

      await expect(store.load('user-1', new Date('2026-08-26T00:01:00.000Z'))).resolves.toEqual({
        kind: EmailVerificationResendStatus.BLOCKED,
        blockedBy: EmailVerificationResendRestriction.COOLDOWN,
        retryAfterSeconds: 91,
        manualResendsUsed: 2,
        manualResendsRemaining: 3,
        lastLogicalSendAt: new Date('2026-08-26T00:00:00.000Z'),
      });
    });

    it('rejects malformed or inconsistent responses', async () => {
      evalScript.mockResolvedValue([0, 2, 5, '']);

      await expect(store.load('user-1', new Date())).rejects.toThrow('remaining count');
    });
  });

  describe('mutations', () => {
    it('parses acquisition and validates complete/abort acknowledgements', async () => {
      evalScript.mockResolvedValueOnce([0, 0]).mockResolvedValueOnce([0, 1, 1_000, 1_000]).mockResolvedValueOnce([1]);

      await expect(store.beginMutation('user-1', 'mutation-1', new Date())).resolves.toEqual({
        kind: EmailVerificationResendMutationKind.ACQUIRED,
        manualResendsUsed: 0,
      });
      await expect(
        store.completeLogicalSend({
          userId: 'user-1',
          origin: EmailVerificationChallengeOrigin.MANUAL_RESEND,
          challengeId: 'challenge-1',
          logicalSendAt: new Date(),
          now: new Date(),
          mutationToken: 'mutation-1',
        }),
      ).resolves.toBeUndefined();
      await expect(store.abortMutation('user-1', 'mutation-1')).resolves.toBeUndefined();
    });

    it('rejects a technical Lua status instead of authorizing the mutation', async () => {
      evalScript.mockResolvedValue([9]);

      await expect(store.beginMutation('user-1', 'mutation-1', new Date())).rejects.toThrow('mutation status');
    });
  });
});
