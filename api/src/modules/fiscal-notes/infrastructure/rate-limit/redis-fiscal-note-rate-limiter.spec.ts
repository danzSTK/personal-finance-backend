import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { type FiscalNotesConfig } from '@/config/fiscal-notes.config';
import { RedisService } from '@/database/redis/redis.service';
import {
  FiscalNoteRateLimitExceededError,
  SefazTemporarilyUnavailableError,
} from '@/modules/fiscal-notes/application/errors';
import {
  FISCAL_NOTE_RATE_LIMIT_WINDOW_1H_SECONDS,
  FISCAL_NOTE_RATE_LIMIT_WINDOW_1M_SECONDS,
  FiscalNoteAlertKeys,
  FiscalNoteLogEvents,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { RedisFiscalNoteRateLimiter } from '@/modules/fiscal-notes/infrastructure/rate-limit/redis-fiscal-note-rate-limiter';
import { OperationalAlertService, OperationalAlertSeverities } from '@/shared/observability';
import { Logger } from '@nestjs/common';

describe('RedisFiscalNoteRateLimiter', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const uf = '23';
  const config = {
    rateLimit: {
      userPerMinute: 5,
      userPerHour: 30,
      globalPerMinute: 40,
    },
  } as unknown as FiscalNotesConfig;

  let redisClient: { eval: jest.Mock };
  let redisService: jest.Mocked<Pick<RedisService, 'getClient'>>;
  let alertService: jest.Mocked<Pick<OperationalAlertService, 'notify'>>;
  let limiter: RedisFiscalNoteRateLimiter;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    redisClient = { eval: jest.fn() };
    redisService = { getClient: jest.fn().mockReturnValue(redisClient) };
    alertService = { notify: jest.fn() };
    limiter = new RedisFiscalNoteRateLimiter(
      redisService as unknown as RedisService,
      config,
      alertService as unknown as OperationalAlertService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('consumeSefazQuota', () => {
    it('allows request when user and global quotas pass and checks user quota first', async () => {
      redisClient.eval.mockResolvedValueOnce([1, 0]).mockResolvedValueOnce([1, 0]);

      await expect(limiter.consumeSefazQuota({ userId, uf })).resolves.toBeUndefined();

      expect(redisClient.eval).toHaveBeenCalledTimes(2);
      expect(redisClient.eval).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        2,
        CacheKeys.fiscalNotes.rateLimitUser1m(userId),
        CacheKeys.fiscalNotes.rateLimitUser1h(userId),
        5,
        FISCAL_NOTE_RATE_LIMIT_WINDOW_1M_SECONDS,
        30,
        FISCAL_NOTE_RATE_LIMIT_WINDOW_1H_SECONDS,
      );
      expect(redisClient.eval).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        1,
        CacheKeys.fiscalNotes.rateLimitGlobal1m(uf),
        40,
        FISCAL_NOTE_RATE_LIMIT_WINDOW_1M_SECONDS,
      );
    });

    it('throws FiscalNoteRateLimitExceededError without touching global counter when user quota is exceeded', async () => {
      redisClient.eval.mockResolvedValueOnce([0, 42]);

      const promise = limiter.consumeSefazQuota({ userId, uf });
      await expect(promise).rejects.toThrow(FiscalNoteRateLimitExceededError);
      await expect(promise).rejects.toMatchObject({
        code: 'FISCAL_NOTE_RATE_LIMIT_EXCEEDED',
        retryAfterSeconds: 42,
      });

      expect(redisClient.eval).toHaveBeenCalledTimes(1);
      expect(alertService.notify).not.toHaveBeenCalled();
    });

    it('throws SefazTemporarilyUnavailableError and sends WARN alert when global UF quota is exceeded', async () => {
      redisClient.eval.mockResolvedValueOnce([1, 0]).mockResolvedValueOnce([0, 27]);

      const promise = limiter.consumeSefazQuota({ userId, uf });
      await expect(promise).rejects.toThrow(SefazTemporarilyUnavailableError);
      await expect(promise).rejects.toMatchObject({ retryAfterSeconds: 27 });

      expect(alertService.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          alertKey: FiscalNoteAlertKeys.sefazGlobalRateLimit(uf),
          event: FiscalNoteLogEvents.FISCAL_NOTE_SEFAZ_GLOBAL_RL_HIT,
          severity: OperationalAlertSeverities.WARN,
        }),
      );
    });

    it('fails open with warning log when Redis throws', async () => {
      redisClient.eval.mockRejectedValue(new Error('Redis unreachable'));

      await expect(limiter.consumeSefazQuota({ userId, uf })).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: FiscalNoteLogEvents.FISCAL_NOTE_RATE_LIMIT_REDIS_ERROR,
          uf,
        }),
      );
    });
  });
});
