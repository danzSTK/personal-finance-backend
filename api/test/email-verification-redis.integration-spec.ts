import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { RedisService } from '@/database/redis/redis.service';
import {
  EmailVerificationChallengeOrigin,
  EmailVerificationResendMutationKind,
  EmailVerificationResendRestriction,
  EmailVerificationResendStatus,
} from '@/modules/auth/domain/constants/email-verification.constants';
import { RedisEmailVerificationResendStateStore } from '@/modules/auth/infrastructure/cache/redis-email-verification-resend-state-store';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

describe('Email verification Redis state integration', () => {
  const password = 'email-verification-integration';
  let container: StartedRedisContainer | undefined;
  let client: Redis | undefined;
  let store: RedisEmailVerificationResendStateStore;

  beforeAll(async () => {
    container = await new RedisContainer('redis:7-alpine').withPassword(password).start();
    client = new Redis({
      host: container.getHost(),
      port: container.getPort(),
      password,
      maxRetriesPerRequest: 1,
    });
    store = new RedisEmailVerificationResendStateStore(new RedisService(client));
  });

  afterAll(async () => {
    if (client) {
      if (client.status === 'ready') {
        await client.quit();
      } else {
        client.disconnect();
      }
    }
    await container?.stop();
  });

  beforeEach(async () => {
    await client!.flushdb();
  });

  it('treats missing keys as empty and only lets one concurrent mutation acquire the barrier', async () => {
    const userId = randomUUID();
    const now = new Date();

    await expect(store.load(userId, now)).resolves.toMatchObject({
      kind: EmailVerificationResendStatus.AVAILABLE,
      manualResendsUsed: 0,
      manualResendsRemaining: 5,
    });

    const results = await Promise.all(Array.from({ length: 10 }, () => store.beginMutation(userId, randomUUID(), now)));

    expect(results.filter(result => result.kind === EmailVerificationResendMutationKind.ACQUIRED)).toHaveLength(1);
    expect(results.filter(result => result.kind === EmailVerificationResendMutationKind.BLOCKED)).toHaveLength(9);
  });

  it('registers automatic cooldown without consuming the manual window', async () => {
    const userId = randomUUID();
    const now = new Date();

    await store.completeLogicalSend({
      userId,
      origin: EmailVerificationChallengeOrigin.AUTOMATIC,
      challengeId: randomUUID(),
      logicalSendAt: now,
      now,
    });

    await expect(store.load(userId, now)).resolves.toMatchObject({
      kind: EmailVerificationResendStatus.BLOCKED,
      blockedBy: EmailVerificationResendRestriction.COOLDOWN,
      manualResendsUsed: 0,
      manualResendsRemaining: 5,
    });
  });

  it('counts each manual challenge once and blocks the sixth reservation for the 24 hour window', async () => {
    const userId = randomUUID();
    const now = new Date();
    const cooldownKey = CacheKeys.auth.emailVerification.cooldown(userId);

    for (let index = 0; index < 5; index += 1) {
      const challengeId = randomUUID();
      await store.completeLogicalSend({
        userId,
        origin: EmailVerificationChallengeOrigin.MANUAL_RESEND,
        challengeId,
        logicalSendAt: new Date(now.getTime() + index),
        now,
      });
      await store.completeLogicalSend({
        userId,
        origin: EmailVerificationChallengeOrigin.MANUAL_RESEND,
        challengeId,
        logicalSendAt: new Date(now.getTime() + index),
        now,
      });
      await client!.del(cooldownKey);
    }

    await expect(store.load(userId, now)).resolves.toMatchObject({
      kind: EmailVerificationResendStatus.BLOCKED,
      blockedBy: EmailVerificationResendRestriction.DAILY_LIMIT,
      manualResendsUsed: 5,
      manualResendsRemaining: 0,
    });
    await expect(store.beginMutation(userId, randomUUID(), now)).resolves.toMatchObject({
      kind: EmailVerificationResendMutationKind.BLOCKED,
      blockedBy: EmailVerificationResendRestriction.DAILY_LIMIT,
      manualResendsUsed: 5,
    });
  });

  it('only lets the mutation owner remove the pending barrier', async () => {
    const userId = randomUUID();
    const ownerToken = randomUUID();
    const now = new Date();

    await store.beginMutation(userId, ownerToken, now);
    await store.abortMutation(userId, randomUUID());
    await expect(store.load(userId, now)).resolves.toMatchObject({
      kind: EmailVerificationResendStatus.BLOCKED,
      blockedBy: EmailVerificationResendRestriction.OPERATION_PENDING,
    });

    await store.abortMutation(userId, ownerToken);
    await expect(store.load(userId, now)).resolves.toMatchObject({
      kind: EmailVerificationResendStatus.AVAILABLE,
    });
  });

  it('renews only the owned pending barrier and restores its full TTL', async () => {
    const userId = randomUUID();
    const ownerToken = randomUUID();
    const pendingKey = CacheKeys.auth.emailVerification.pending(userId);

    await store.beginMutation(userId, ownerToken, new Date());
    await client!.pexpire(pendingKey, 1_000);
    await expect(store.renewMutation(userId, ownerToken)).resolves.toBeUndefined();
    await expect(client!.pttl(pendingKey)).resolves.toBeGreaterThan(29_000);

    await expect(store.renewMutation(userId, randomUUID())).rejects.toThrow('ownership was lost');
    await expect(client!.get(pendingKey)).resolves.toBe(ownerToken);
  });
});
