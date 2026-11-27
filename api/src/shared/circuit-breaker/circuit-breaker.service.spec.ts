import { RedisService } from '@/database/redis/redis.service';
import { CircuitBreakerService } from '@/shared/circuit-breaker/circuit-breaker.service';
import {
  CIRCUIT_BREAKER_PROBE_KEY_SUFFIX,
  CIRCUIT_BREAKER_PROBE_LOCK_VALUE,
  CIRCUIT_BREAKER_REDIS_SET_OK,
  CircuitBreakerLogEvents,
  CircuitBreakerStates,
  DEFAULT_CIRCUIT_BREAKER_COOLDOWN_SECONDS,
  DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
  DEFAULT_CIRCUIT_BREAKER_PROBE_LOCK_TTL_SECONDS,
  DEFAULT_CIRCUIT_BREAKER_STATE_TTL_SECONDS,
} from '@/shared/circuit-breaker/constants/circuit-breaker.constants';
import type {
  CircuitBreakerOptions,
  CircuitBreakerStateRecord,
} from '@/shared/circuit-breaker/contracts/circuit-breaker.interface';
import { Logger } from '@nestjs/common';

describe('CircuitBreakerService', () => {
  const baseKey = 'fiscal-notes:cb:v1:23';
  const baseOptions: CircuitBreakerOptions = {
    key: baseKey,
    failureThreshold: DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    cooldownSeconds: DEFAULT_CIRCUIT_BREAKER_COOLDOWN_SECONDS,
  };

  let store: Map<string, string>;
  let redisClient: {
    get: jest.Mock<Promise<string | null>, [string]>;
    set: jest.Mock<Promise<string | null>, unknown[]>;
    del: jest.Mock<Promise<number>, [string]>;
  };
  let redisService: jest.Mocked<Pick<RedisService, 'getClient'>>;
  let service: CircuitBreakerService;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-26T15:00:00.000Z'));

    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    store = new Map<string, string>();
    redisClient = {
      get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      set: jest.fn((...args: unknown[]) => {
        const key = String(args[0]);
        const value = String(args[1]);
        const hasNx = args.includes('NX');

        if (hasNx && store.has(key)) {
          return Promise.resolve(null);
        }

        store.set(key, value);
        return Promise.resolve(CIRCUIT_BREAKER_REDIS_SET_OK);
      }),
      del: jest.fn((key: string) => {
        const deleted = store.delete(key);
        return Promise.resolve(deleted ? 1 : 0);
      }),
    };

    redisService = {
      getClient: jest.fn().mockReturnValue(redisClient),
    };

    service = new CircuitBreakerService(redisService as unknown as RedisService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('canExecute', () => {
    it('allows execution when state does not exist in Redis', async () => {
      const decision = await service.canExecute(baseOptions);

      expect(decision).toEqual({
        allowed: true,
        state: CircuitBreakerStates.CLOSED,
      });
    });

    it('fails fast with retryAfterSeconds when circuit is OPEN and cooldown has not expired', async () => {
      const now = Date.now();
      const openState: CircuitBreakerStateRecord = {
        state: CircuitBreakerStates.OPEN,
        consecutiveFailures: 5,
        cooldownStage: 0,
        openedAtMs: now - 15_000,
        nextAttemptAtMs: now + 45_000,
      };
      store.set(baseKey, JSON.stringify(openState));

      const decision = await service.canExecute(baseOptions);

      expect(decision).toEqual({
        allowed: false,
        state: CircuitBreakerStates.OPEN,
        retryAfterSeconds: 45,
      });
    });

    it('transitions OPEN -> HALF_OPEN for a single probe after cooldown expires and blocks concurrent callers', async () => {
      const now = Date.now();
      const openState: CircuitBreakerStateRecord = {
        state: CircuitBreakerStates.OPEN,
        consecutiveFailures: 5,
        cooldownStage: 0,
        openedAtMs: now - 60_000,
        nextAttemptAtMs: now,
      };
      store.set(baseKey, JSON.stringify(openState));

      const firstCaller = await service.canExecute(baseOptions);
      const secondCaller = await service.canExecute(baseOptions);

      expect(firstCaller).toEqual({
        allowed: true,
        state: CircuitBreakerStates.HALF_OPEN,
        transitionedTo: CircuitBreakerStates.HALF_OPEN,
      });
      expect(secondCaller).toEqual({
        allowed: false,
        state: CircuitBreakerStates.HALF_OPEN,
        retryAfterSeconds: DEFAULT_CIRCUIT_BREAKER_PROBE_LOCK_TTL_SECONDS,
      });
      expect(redisClient.set).toHaveBeenCalledWith(
        `${baseKey}${CIRCUIT_BREAKER_PROBE_KEY_SUFFIX}`,
        CIRCUIT_BREAKER_PROBE_LOCK_VALUE,
        'EX',
        DEFAULT_CIRCUIT_BREAKER_PROBE_LOCK_TTL_SECONDS,
        'NX',
      );
      expect(warnSpy).toHaveBeenCalledWith({
        event: CircuitBreakerLogEvents.CIRCUIT_HALF_OPEN,
        key: baseKey,
        cooldownStage: 0,
      });
    });

    it('blocks OPEN transition when another worker already acquired the probe lock', async () => {
      const now = Date.now();
      store.set(
        baseKey,
        JSON.stringify({
          state: CircuitBreakerStates.OPEN,
          consecutiveFailures: 5,
          cooldownStage: 0,
          openedAtMs: now - 60_000,
          nextAttemptAtMs: now,
        }),
      );
      store.set(`${baseKey}${CIRCUIT_BREAKER_PROBE_KEY_SUFFIX}`, CIRCUIT_BREAKER_PROBE_LOCK_VALUE);

      const decision = await service.canExecute(baseOptions);

      expect(decision).toEqual({
        allowed: false,
        state: CircuitBreakerStates.OPEN,
        retryAfterSeconds: DEFAULT_CIRCUIT_BREAKER_PROBE_LOCK_TTL_SECONDS,
      });
    });

    it('re-acquires probe lock and allows a probe if circuit is HALF_OPEN and previous probe lock expired', async () => {
      store.set(
        baseKey,
        JSON.stringify({
          state: CircuitBreakerStates.HALF_OPEN,
          consecutiveFailures: 5,
          cooldownStage: 1,
          openedAtMs: Date.now() - 120_000,
          nextAttemptAtMs: Date.now(),
        }),
      );

      const decision = await service.canExecute(baseOptions);

      expect(decision).toEqual({
        allowed: true,
        state: CircuitBreakerStates.HALF_OPEN,
      });
    });
  });

  describe('recordFailure', () => {
    it('stays CLOSED below threshold and opens at threshold N with initial cooldown stage', async () => {
      for (let attempt = 1; attempt < baseOptions.failureThreshold; attempt++) {
        const result = await service.recordFailure(baseOptions);
        expect(result).toEqual({
          previousState: CircuitBreakerStates.CLOSED,
          currentState: CircuitBreakerStates.CLOSED,
          opened: false,
          consecutiveFailures: attempt,
          cooldownStage: 0,
        });
      }

      const openingResult = await service.recordFailure(baseOptions);

      expect(openingResult).toEqual({
        previousState: CircuitBreakerStates.CLOSED,
        currentState: CircuitBreakerStates.OPEN,
        opened: true,
        retryAfterSeconds: 60,
        consecutiveFailures: 5,
        cooldownStage: 0,
      });
      expect(redisClient.set).toHaveBeenCalledWith(
        baseKey,
        expect.any(String),
        'EX',
        DEFAULT_CIRCUIT_BREAKER_STATE_TTL_SECONDS,
      );
      expect(warnSpy).toHaveBeenCalledWith({
        event: CircuitBreakerLogEvents.CIRCUIT_OPENED,
        key: baseKey,
        previousState: CircuitBreakerStates.CLOSED,
        consecutiveFailures: 5,
        cooldownStage: 0,
        retryAfterSeconds: 60,
      });
    });

    it('escalates cooldown progressively (60 -> 120 -> 300 -> 300) when HALF_OPEN probe fails', async () => {
      for (let i = 0; i < baseOptions.failureThreshold; i++) {
        await service.recordFailure(baseOptions);
      }

      jest.advanceTimersByTime(60_000);
      await service.canExecute(baseOptions);
      const stage1Failure = await service.recordFailure(baseOptions);
      expect(stage1Failure).toMatchObject({
        previousState: CircuitBreakerStates.HALF_OPEN,
        currentState: CircuitBreakerStates.OPEN,
        opened: true,
        retryAfterSeconds: 120,
        cooldownStage: 1,
      });

      jest.advanceTimersByTime(120_000);
      await service.canExecute(baseOptions);
      const stage2Failure = await service.recordFailure(baseOptions);
      expect(stage2Failure).toMatchObject({
        previousState: CircuitBreakerStates.HALF_OPEN,
        currentState: CircuitBreakerStates.OPEN,
        opened: true,
        retryAfterSeconds: 300,
        cooldownStage: 2,
      });

      jest.advanceTimersByTime(300_000);
      await service.canExecute(baseOptions);
      const stage3Failure = await service.recordFailure(baseOptions);
      expect(stage3Failure).toMatchObject({
        previousState: CircuitBreakerStates.HALF_OPEN,
        currentState: CircuitBreakerStates.OPEN,
        opened: true,
        retryAfterSeconds: 300,
        cooldownStage: 2,
      });
    });

    it('keeps OPEN state when recordFailure is called while already OPEN', async () => {
      const now = Date.now();
      store.set(
        baseKey,
        JSON.stringify({
          state: CircuitBreakerStates.OPEN,
          consecutiveFailures: 5,
          cooldownStage: 0,
          openedAtMs: now - 10_000,
          nextAttemptAtMs: now + 50_000,
        }),
      );

      const result = await service.recordFailure(baseOptions);

      expect(result).toEqual({
        previousState: CircuitBreakerStates.OPEN,
        currentState: CircuitBreakerStates.OPEN,
        opened: false,
        retryAfterSeconds: 50,
        consecutiveFailures: 5,
        cooldownStage: 0,
      });
    });
  });

  describe('recordSuccess', () => {
    it('avoids unnecessary Redis write when already CLOSED with zero consecutive failures', async () => {
      const result = await service.recordSuccess(baseOptions);

      expect(result).toEqual({
        previousState: CircuitBreakerStates.CLOSED,
        currentState: CircuitBreakerStates.CLOSED,
        closedFromHalfOpen: false,
      });
      expect(redisClient.set).not.toHaveBeenCalled();
      expect(redisClient.del).toHaveBeenCalledWith(`${baseKey}${CIRCUIT_BREAKER_PROBE_KEY_SUFFIX}`);
    });

    it('resets state and cooldownStage to CLOSED when HALF_OPEN probe succeeds', async () => {
      for (let i = 0; i < baseOptions.failureThreshold; i++) {
        await service.recordFailure(baseOptions);
      }

      jest.advanceTimersByTime(60_000);
      await service.canExecute(baseOptions);
      await service.recordFailure(baseOptions);
      jest.advanceTimersByTime(120_000);
      await service.canExecute(baseOptions);

      const successResult = await service.recordSuccess(baseOptions);

      expect(successResult).toEqual({
        previousState: CircuitBreakerStates.HALF_OPEN,
        currentState: CircuitBreakerStates.CLOSED,
        closedFromHalfOpen: true,
      });
      expect(logSpy).toHaveBeenCalledWith({
        event: CircuitBreakerLogEvents.CIRCUIT_CLOSED,
        key: baseKey,
        previousState: CircuitBreakerStates.HALF_OPEN,
      });

      const persisted = JSON.parse(store.get(baseKey) ?? '{}') as CircuitBreakerStateRecord;
      expect(persisted).toEqual({
        state: CircuitBreakerStates.CLOSED,
        consecutiveFailures: 0,
        cooldownStage: 0,
        openedAtMs: null,
        nextAttemptAtMs: null,
      });
    });
  });

  describe('releaseProbe', () => {
    it('releases probe lock and restores HALF_OPEN state to OPEN preserving metadata so next caller can probe immediately', async () => {
      const openedAtMs = Date.now() - 120_000;
      const nextAttemptAtMs = Date.now();
      store.set(
        baseKey,
        JSON.stringify({
          state: CircuitBreakerStates.OPEN,
          consecutiveFailures: 5,
          cooldownStage: 1,
          openedAtMs,
          nextAttemptAtMs,
        }),
      );

      const firstProbe = await service.canExecute(baseOptions);
      expect(firstProbe).toEqual({
        allowed: true,
        state: CircuitBreakerStates.HALF_OPEN,
        transitionedTo: CircuitBreakerStates.HALF_OPEN,
      });
      expect(store.has(`${baseKey}${CIRCUIT_BREAKER_PROBE_KEY_SUFFIX}`)).toBe(true);

      await service.releaseProbe(baseOptions);

      expect(store.has(`${baseKey}${CIRCUIT_BREAKER_PROBE_KEY_SUFFIX}`)).toBe(false);
      expect(JSON.parse(store.get(baseKey) ?? '{}')).toEqual({
        state: CircuitBreakerStates.OPEN,
        consecutiveFailures: 5,
        cooldownStage: 1,
        openedAtMs,
        nextAttemptAtMs,
      });

      const nextProbe = await service.canExecute(baseOptions);
      expect(nextProbe).toEqual({
        allowed: true,
        state: CircuitBreakerStates.HALF_OPEN,
        transitionedTo: CircuitBreakerStates.HALF_OPEN,
      });
    });

    it('is a state no-op when circuit is CLOSED and does not write state', async () => {
      await service.releaseProbe(baseOptions);

      expect(redisClient.del).toHaveBeenCalledWith(`${baseKey}${CIRCUIT_BREAKER_PROBE_KEY_SUFFIX}`);
      expect(redisClient.set).not.toHaveBeenCalled();
    });
  });

  describe('fail-open resilience', () => {
    it('fails open and logs warning when Redis throws during canExecute, recordSuccess, recordFailure, or releaseProbe', async () => {
      redisClient.get.mockRejectedValue(new Error('Redis connection lost'));

      const decision = await service.canExecute(baseOptions);
      const success = await service.recordSuccess(baseOptions);
      const failure = await service.recordFailure(baseOptions);
      await expect(service.releaseProbe(baseOptions)).resolves.toBeUndefined();

      expect(decision).toEqual({
        allowed: true,
        state: CircuitBreakerStates.CLOSED,
      });
      expect(success).toEqual({
        previousState: CircuitBreakerStates.CLOSED,
        currentState: CircuitBreakerStates.CLOSED,
        closedFromHalfOpen: false,
      });
      expect(failure).toEqual({
        previousState: CircuitBreakerStates.CLOSED,
        currentState: CircuitBreakerStates.CLOSED,
        opened: false,
        consecutiveFailures: 0,
        cooldownStage: 0,
      });
      expect(warnSpy).toHaveBeenCalledTimes(4);
      expect(warnSpy).toHaveBeenCalledWith({
        event: CircuitBreakerLogEvents.REDIS_ERROR,
        key: baseKey,
        errorMessage: 'Redis connection lost',
      });
    });

    it('fails open when RedisService is not provided', async () => {
      const noRedisService = new CircuitBreakerService(undefined);

      await expect(noRedisService.canExecute(baseOptions)).resolves.toEqual({
        allowed: true,
        state: CircuitBreakerStates.CLOSED,
      });
      await expect(noRedisService.recordSuccess(baseOptions)).resolves.toEqual({
        previousState: CircuitBreakerStates.CLOSED,
        currentState: CircuitBreakerStates.CLOSED,
        closedFromHalfOpen: false,
      });
      await expect(noRedisService.recordFailure(baseOptions)).resolves.toEqual({
        previousState: CircuitBreakerStates.CLOSED,
        currentState: CircuitBreakerStates.CLOSED,
        opened: false,
        consecutiveFailures: 0,
        cooldownStage: 0,
      });
      await expect(noRedisService.releaseProbe(baseOptions)).resolves.toBeUndefined();
    });
  });
});
