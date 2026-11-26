import { CacheKeys } from '@/common/utils/cache-keys.factory';
import fiscalNotesConfig, { type FiscalNotesConfig } from '@/config/fiscal-notes.config';
import { RedisService } from '@/database/redis/redis.service';
import {
  FiscalNoteRateLimitExceededError,
  SefazTemporarilyUnavailableError,
} from '@/modules/fiscal-notes/application/errors';
import {
  ConsumeSefazQuotaInput,
  IFiscalNoteRateLimiter,
} from '@/modules/fiscal-notes/application/ports/fiscal-note-rate-limiter.port';
import {
  FISCAL_NOTE_RATE_LIMIT_MIN_RETRY_SECONDS,
  FISCAL_NOTE_RATE_LIMIT_WINDOW_1H_SECONDS,
  FISCAL_NOTE_RATE_LIMIT_WINDOW_1M_SECONDS,
  FiscalNoteAlertKeys,
  FiscalNoteLogEvents,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { OperationalAlertService, OperationalAlertSeverities } from '@/shared/observability';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

const CONSUME_USER_QUOTA_SCRIPT = String.raw`
local c1m = tonumber(redis.call('GET', KEYS[1]) or '0')
local l1m = tonumber(ARGV[1])
local w1m = tonumber(ARGV[2])
local c1h = tonumber(redis.call('GET', KEYS[2]) or '0')
local l1h = tonumber(ARGV[3])
local w1h = tonumber(ARGV[4])

local retry1m = 0
if c1m >= l1m then
  local t1m = redis.call('TTL', KEYS[1])
  retry1m = t1m > 0 and t1m or w1m
end

local retry1h = 0
if c1h >= l1h then
  local t1h = redis.call('TTL', KEYS[2])
  retry1h = t1h > 0 and t1h or w1h
end

if retry1m > 0 or retry1h > 0 then
  return {0, math.max(retry1m, retry1h)}
end

local n1m = redis.call('INCR', KEYS[1])
if n1m == 1 or redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], w1m)
end

local n1h = redis.call('INCR', KEYS[2])
if n1h == 1 or redis.call('TTL', KEYS[2]) < 0 then
  redis.call('EXPIRE', KEYS[2], w1h)
end

return {1, 0}
`;

const CONSUME_GLOBAL_QUOTA_SCRIPT = String.raw`
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

if current >= limit then
  local ttl = redis.call('TTL', KEYS[1])
  return {0, ttl > 0 and ttl or window}
end

local count = redis.call('INCR', KEYS[1])
if count == 1 or redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], window)
end

return {1, 0}
`;

@Injectable()
export class RedisFiscalNoteRateLimiter extends IFiscalNoteRateLimiter {
  private readonly logger = new Logger(RedisFiscalNoteRateLimiter.name);

  constructor(
    private readonly redisService: RedisService,
    @Inject(fiscalNotesConfig.KEY)
    private readonly config: FiscalNotesConfig,
    @Optional()
    private readonly operationalAlertService?: OperationalAlertService,
  ) {
    super();
  }

  async consumeSefazQuota(input: ConsumeSefazQuotaInput): Promise<void> {
    const user1mKey = CacheKeys.fiscalNotes.rateLimitUser1m(input.userId);
    const user1hKey = CacheKeys.fiscalNotes.rateLimitUser1h(input.userId);
    const global1mKey = CacheKeys.fiscalNotes.rateLimitGlobal1m(input.uf);

    try {
      const client = this.redisService.getClient();

      const userRaw = await client.eval(
        CONSUME_USER_QUOTA_SCRIPT,
        2,
        user1mKey,
        user1hKey,
        this.config.rateLimit.userPerMinute,
        FISCAL_NOTE_RATE_LIMIT_WINDOW_1M_SECONDS,
        this.config.rateLimit.userPerHour,
        FISCAL_NOTE_RATE_LIMIT_WINDOW_1H_SECONDS,
      );

      const userResult = this.parseLuaQuotaResult(userRaw);
      if (!userResult.allowed) {
        throw new FiscalNoteRateLimitExceededError(userResult.retryAfterSeconds);
      }

      const globalRaw = await client.eval(
        CONSUME_GLOBAL_QUOTA_SCRIPT,
        1,
        global1mKey,
        this.config.rateLimit.globalPerMinute,
        FISCAL_NOTE_RATE_LIMIT_WINDOW_1M_SECONDS,
      );

      const globalResult = this.parseLuaQuotaResult(globalRaw);
      if (!globalResult.allowed) {
        this.logger.warn({
          event: FiscalNoteLogEvents.FISCAL_NOTE_SEFAZ_GLOBAL_RL_HIT,
          uf: input.uf,
          retryAfterSeconds: globalResult.retryAfterSeconds,
        });

        this.operationalAlertService?.notify({
          alertKey: FiscalNoteAlertKeys.sefazGlobalRateLimit(input.uf),
          event: FiscalNoteLogEvents.FISCAL_NOTE_SEFAZ_GLOBAL_RL_HIT,
          severity: OperationalAlertSeverities.WARN,
          title: `Limite global de consultas SEFAZ atingido (UF ${input.uf})`,
          summary: `Cota global por minuto da UF ${input.uf} foi atingida em cache miss.`,
          metadata: {
            uf: input.uf,
            retryAfterSeconds: globalResult.retryAfterSeconds,
          },
        });

        throw new SefazTemporarilyUnavailableError(globalResult.retryAfterSeconds);
      }
    } catch (error: unknown) {
      if (error instanceof FiscalNoteRateLimitExceededError || error instanceof SefazTemporarilyUnavailableError) {
        throw error;
      }

      this.logger.warn({
        event: FiscalNoteLogEvents.FISCAL_NOTE_RATE_LIMIT_REDIS_ERROR,
        uf: input.uf,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private parseLuaQuotaResult(raw: unknown): { allowed: boolean; retryAfterSeconds: number } {
    if (!Array.isArray(raw) || raw.length < 2) {
      throw new Error('Invalid fiscal note rate limiter Lua response.');
    }

    const allowed = Number(raw[0]) === 1;
    const rawRetry = Number(raw[1]);
    const retryAfterSeconds =
      Number.isFinite(rawRetry) && rawRetry >= FISCAL_NOTE_RATE_LIMIT_MIN_RETRY_SECONDS
        ? Math.ceil(rawRetry)
        : FISCAL_NOTE_RATE_LIMIT_WINDOW_1M_SECONDS;

    return { allowed, retryAfterSeconds };
  }
}
