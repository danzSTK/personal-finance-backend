import { RedisService } from '@/database/redis/redis.service';
import { PasswordChangeStateLoadResultKind } from '@/modules/auth/application/ports/password-change-state-store.interface';
import { RedisPasswordChangeStateStore } from '@/modules/auth/infrastructure/cache/redis-password-change-state-store';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

describe('Password change Redis state integration', () => {
  const password = 'password-change-integration';
  let container: StartedRedisContainer;
  let client: Redis;
  let store: RedisPasswordChangeStateStore;

  beforeAll(async () => {
    container = await new RedisContainer('redis:7-alpine').withPassword(password).start();
    client = new Redis({
      host: container.getHost(),
      port: container.getPort(),
      password,
      maxRetriesPerRequest: 1,
    });
    store = new RedisPasswordChangeStateStore(new RedisService(client));
  });

  afterAll(async () => {
    if (client.status === 'ready') {
      await client.quit();
    } else {
      client.disconnect();
    }
    await container.stop();
  });

  beforeEach(async () => {
    await client.flushdb();
  });

  it('replaces and loads a complete projection', async () => {
    const userId = randomUUID();
    const now = new Date('2026-07-30T12:00:00.000Z');
    const failedAt = new Date(now.getTime() - 60_000);
    const changedAt = new Date(now.getTime() - 11 * 60_000);
    const blockedUntil = new Date(now.getTime() + 60 * 60_000);

    await store.replace(
      userId,
      {
        failedAttempts: [{ eventId: randomUUID(), occurredAt: failedAt }],
        completedChanges: [{ eventId: randomUUID(), occurredAt: changedAt }],
        blockedUntil,
        lastBlockStartedAt: now,
      },
      now,
    );

    await expect(store.load(userId, now)).resolves.toEqual({
      kind: PasswordChangeStateLoadResultKind.READY,
      state: {
        failedAttemptsInWindow: 1,
        blockedUntil,
        lastBlockStartedAt: now,
        completedChangesAt: [changedAt],
      },
    });
  });

  it('allows only one concurrent mutation owner and returns a positive PTTL to the others', async () => {
    const userId = randomUUID();
    const now = new Date();
    await store.replace(
      userId,
      {
        failedAttempts: [],
        completedChanges: [],
        blockedUntil: null,
        lastBlockStartedAt: null,
      },
      now,
    );

    const results = await Promise.all(
      Array.from({ length: 10 }, () => store.beginMutation(userId, randomUUID(), 120_000)),
    );

    expect(results.filter(result => result.acquired)).toHaveLength(1);
    for (const result of results.filter(result => !result.acquired)) {
      if (!result.acquired) {
        expect(result.acquired).toBe(false);
        expect(typeof result.retryAfterSeconds).toBe('number');
        expect(result.retryAfterSeconds).toBeGreaterThan(0);
      }
    }
  });

  it('only lets the mutation owner clear the pending barrier', async () => {
    const userId = randomUUID();
    const now = new Date();
    const ownerToken = randomUUID();
    await store.replace(
      userId,
      {
        failedAttempts: [],
        completedChanges: [],
        blockedUntil: null,
        lastBlockStartedAt: null,
      },
      now,
    );
    await store.beginMutation(userId, ownerToken, 120_000);

    await store.replace(
      userId,
      {
        failedAttempts: [],
        completedChanges: [],
        blockedUntil: null,
        lastBlockStartedAt: null,
      },
      now,
      randomUUID(),
    );
    await expect(store.load(userId, now)).resolves.toMatchObject({
      kind: PasswordChangeStateLoadResultKind.PENDING,
    });

    await store.replace(
      userId,
      {
        failedAttempts: [],
        completedChanges: [],
        blockedUntil: null,
        lastBlockStartedAt: null,
      },
      now,
      ownerToken,
    );
    await expect(store.load(userId, now)).resolves.toMatchObject({
      kind: PasswordChangeStateLoadResultKind.READY,
    });
  });
});
