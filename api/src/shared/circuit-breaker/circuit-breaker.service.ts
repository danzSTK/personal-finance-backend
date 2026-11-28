import { RedisService } from '@/database/redis/redis.service';
import {
  CIRCUIT_BREAKER_PROBE_KEY_SUFFIX,
  CIRCUIT_BREAKER_PROBE_LOCK_VALUE,
  CIRCUIT_BREAKER_RECORD_FAILURE_NUM_KEYS,
  CIRCUIT_BREAKER_REDIS_SET_OK,
  CircuitBreakerLogEvents,
  CircuitBreakerStates,
  type CircuitBreakerState,
  DEFAULT_CIRCUIT_BREAKER_COOLDOWN_SECONDS,
  DEFAULT_CIRCUIT_BREAKER_PROBE_LOCK_TTL_SECONDS,
  DEFAULT_CIRCUIT_BREAKER_STATE_TTL_SECONDS,
} from '@/shared/circuit-breaker/constants/circuit-breaker.constants';
import type {
  CircuitBreakerDecision,
  CircuitBreakerFailureResult,
  CircuitBreakerOptions,
  CircuitBreakerStateRecord,
  CircuitBreakerSuccessResult,
} from '@/shared/circuit-breaker/contracts/circuit-breaker.interface';
import { Injectable, Logger, Optional } from '@nestjs/common';

const VALID_CIRCUIT_BREAKER_STATES: readonly string[] = Object.values(CircuitBreakerStates);

export const RECORD_FAILURE_LUA_SCRIPT = String.raw`
redis.call('DEL', KEYS[2])

local now = tonumber(ARGV[1])
local failureThreshold = tonumber(ARGV[2])
local stateTtlSeconds = tonumber(ARGV[3])
local okCooldowns, cooldowns = pcall(cjson.decode, ARGV[4])
if not okCooldowns or type(cooldowns) ~= 'table' or #cooldowns == 0 then
  cooldowns = { 60, 120, 300 }
end

local previousState = 'CLOSED'
local consecutiveFailures = 0
local cooldownStage = 0
local openedAtMs = cjson.null
local nextAttemptAtMs = cjson.null

local raw = redis.call('GET', KEYS[1])
if raw then
  local ok, decoded = pcall(cjson.decode, raw)
  if ok and type(decoded) == 'table' then
    local s = decoded['state']
    local cf = decoded['consecutiveFailures']
    local cs = decoded['cooldownStage']
    local oam = decoded['openedAtMs']
    local nam = decoded['nextAttemptAtMs']

    local validState = (s == 'CLOSED' or s == 'OPEN' or s == 'HALF_OPEN')
    local validCf = (type(cf) == 'number' and cf >= 0)
    local validCs = (type(cs) == 'number' and cs >= 0)
    local validOam = (oam == cjson.null or type(oam) == 'number')
    local validNam = (nam == cjson.null or type(nam) == 'number')

    if validState and validCf and validCs and validOam and validNam then
      previousState = s
      consecutiveFailures = cf
      cooldownStage = cs
      openedAtMs = oam
      nextAttemptAtMs = nam
    end
  end
end

if previousState == 'HALF_OPEN' then
  local nextStage = math.min(cooldownStage + 1, #cooldowns - 1)
  local cooldown = cooldowns[nextStage + 1]
  consecutiveFailures = consecutiveFailures + 1

  local nextRecord = cjson.encode({
    state = 'OPEN',
    consecutiveFailures = consecutiveFailures,
    cooldownStage = nextStage,
    openedAtMs = now,
    nextAttemptAtMs = now + cooldown * 1000,
  })
  redis.call('SET', KEYS[1], nextRecord, 'EX', stateTtlSeconds)

  return { previousState, 'OPEN', 1, cooldown, consecutiveFailures, nextStage }
end

if previousState == 'CLOSED' then
  consecutiveFailures = consecutiveFailures + 1

  if consecutiveFailures >= failureThreshold then
    local nextStage = 0
    local cooldown = cooldowns[1]
    local nextRecord = cjson.encode({
      state = 'OPEN',
      consecutiveFailures = consecutiveFailures,
      cooldownStage = nextStage,
      openedAtMs = now,
      nextAttemptAtMs = now + cooldown * 1000,
    })
    redis.call('SET', KEYS[1], nextRecord, 'EX', stateTtlSeconds)

    return { previousState, 'OPEN', 1, cooldown, consecutiveFailures, nextStage }
  end

  local nextRecord = cjson.encode({
    state = 'CLOSED',
    consecutiveFailures = consecutiveFailures,
    cooldownStage = cooldownStage,
    openedAtMs = openedAtMs,
    nextAttemptAtMs = nextAttemptAtMs,
  })
  redis.call('SET', KEYS[1], nextRecord, 'EX', stateTtlSeconds)

  return { previousState, 'CLOSED', 0, -1, consecutiveFailures, cooldownStage }
end

local retryAfter = -1
if type(nextAttemptAtMs) == 'number' and nextAttemptAtMs > now then
  retryAfter = math.max(1, math.ceil((nextAttemptAtMs - now) / 1000))
end

return { previousState, 'OPEN', 0, retryAfter, consecutiveFailures, cooldownStage }
`;

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  constructor(
    @Optional()
    private readonly redisService?: RedisService,
  ) {}

  async canExecute(options: CircuitBreakerOptions): Promise<CircuitBreakerDecision> {
    if (!this.redisService) {
      return {
        allowed: true,
        state: CircuitBreakerStates.CLOSED,
      };
    }

    try {
      const record = await this.readState(options.key);
      const now = Date.now();
      const stateTtlSeconds = this.resolveStateTtlSeconds(options.stateTtlSeconds);
      const probeLockTtlSeconds = this.resolveProbeLockTtlSeconds(options.probeLockTtlSeconds);

      if (record.state === CircuitBreakerStates.CLOSED) {
        return {
          allowed: true,
          state: CircuitBreakerStates.CLOSED,
        };
      }

      if (record.state === CircuitBreakerStates.OPEN) {
        if (record.nextAttemptAtMs !== null && now < record.nextAttemptAtMs) {
          return {
            allowed: false,
            state: CircuitBreakerStates.OPEN,
            retryAfterSeconds: Math.max(1, Math.ceil((record.nextAttemptAtMs - now) / 1000)),
          };
        }

        const acquired = await this.acquireProbeLock(options.key, probeLockTtlSeconds);
        if (!acquired) {
          return {
            allowed: false,
            state: CircuitBreakerStates.OPEN,
            retryAfterSeconds: probeLockTtlSeconds,
          };
        }

        const halfOpenRecord: CircuitBreakerStateRecord = {
          ...record,
          state: CircuitBreakerStates.HALF_OPEN,
        };

        await this.writeState(options.key, halfOpenRecord, stateTtlSeconds);
        this.logger.warn({
          event: CircuitBreakerLogEvents.CIRCUIT_HALF_OPEN,
          key: options.key,
          cooldownStage: record.cooldownStage,
        });

        return {
          allowed: true,
          state: CircuitBreakerStates.HALF_OPEN,
          transitionedTo: CircuitBreakerStates.HALF_OPEN,
        };
      }

      const acquired = await this.acquireProbeLock(options.key, probeLockTtlSeconds);
      if (!acquired) {
        return {
          allowed: false,
          state: CircuitBreakerStates.HALF_OPEN,
          retryAfterSeconds: probeLockTtlSeconds,
        };
      }

      return {
        allowed: true,
        state: CircuitBreakerStates.HALF_OPEN,
      };
    } catch (error) {
      this.logRedisError(options.key, error);
      return {
        allowed: true,
        state: CircuitBreakerStates.CLOSED,
      };
    }
  }

  async recordSuccess(options: CircuitBreakerOptions): Promise<CircuitBreakerSuccessResult> {
    if (!this.redisService) {
      return {
        previousState: CircuitBreakerStates.CLOSED,
        currentState: CircuitBreakerStates.CLOSED,
        closedFromHalfOpen: false,
      };
    }

    try {
      const record = await this.readState(options.key);
      await this.releaseProbeLock(options.key);

      const previousState = record.state;
      if (previousState === CircuitBreakerStates.CLOSED && record.consecutiveFailures === 0) {
        return {
          previousState,
          currentState: CircuitBreakerStates.CLOSED,
          closedFromHalfOpen: false,
        };
      }

      await this.writeState(
        options.key,
        this.createClosedState(),
        this.resolveStateTtlSeconds(options.stateTtlSeconds),
      );

      const closedFromHalfOpen =
        previousState === CircuitBreakerStates.HALF_OPEN || previousState === CircuitBreakerStates.OPEN;

      if (closedFromHalfOpen) {
        this.logger.log({
          event: CircuitBreakerLogEvents.CIRCUIT_CLOSED,
          key: options.key,
          previousState,
        });
      }

      return {
        previousState,
        currentState: CircuitBreakerStates.CLOSED,
        closedFromHalfOpen,
      };
    } catch (error) {
      this.logRedisError(options.key, error);
      return {
        previousState: CircuitBreakerStates.CLOSED,
        currentState: CircuitBreakerStates.CLOSED,
        closedFromHalfOpen: false,
      };
    }
  }

  async recordFailure(options: CircuitBreakerOptions): Promise<CircuitBreakerFailureResult> {
    if (!this.redisService) {
      return {
        previousState: CircuitBreakerStates.CLOSED,
        currentState: CircuitBreakerStates.CLOSED,
        opened: false,
        consecutiveFailures: 0,
        cooldownStage: 0,
      };
    }

    try {
      const now = Date.now();
      const cooldowns = this.resolveCooldowns(options.cooldownSeconds);
      const stateTtlSeconds = this.resolveStateTtlSeconds(options.stateTtlSeconds);
      const failureThreshold = Math.max(1, options.failureThreshold);

      const rawResult = await this.redisService
        .getClient()
        .eval(
          RECORD_FAILURE_LUA_SCRIPT,
          CIRCUIT_BREAKER_RECORD_FAILURE_NUM_KEYS,
          options.key,
          this.buildProbeKey(options.key),
          String(now),
          String(failureThreshold),
          String(stateTtlSeconds),
          JSON.stringify(cooldowns),
        );

      const result = this.parseRecordFailureLuaResult(rawResult);

      if (result.opened) {
        this.logger.warn({
          event: CircuitBreakerLogEvents.CIRCUIT_OPENED,
          key: options.key,
          previousState: result.previousState,
          consecutiveFailures: result.consecutiveFailures,
          cooldownStage: result.cooldownStage,
          retryAfterSeconds: result.retryAfterSeconds,
        });
      }

      return result;
    } catch (error) {
      this.logRedisError(options.key, error);
      return {
        previousState: CircuitBreakerStates.CLOSED,
        currentState: CircuitBreakerStates.CLOSED,
        opened: false,
        consecutiveFailures: 0,
        cooldownStage: 0,
      };
    }
  }

  async releaseProbe(options: CircuitBreakerOptions): Promise<void> {
    if (!this.redisService) {
      return;
    }

    try {
      const record = await this.readState(options.key);
      await this.releaseProbeLock(options.key);

      if (record.state !== CircuitBreakerStates.HALF_OPEN) {
        return;
      }

      const restoredRecord: CircuitBreakerStateRecord = {
        ...record,
        state: CircuitBreakerStates.OPEN,
      };

      await this.writeState(options.key, restoredRecord, this.resolveStateTtlSeconds(options.stateTtlSeconds));
    } catch (error) {
      this.logRedisError(options.key, error);
    }
  }

  private createClosedState(): CircuitBreakerStateRecord {
    return {
      state: CircuitBreakerStates.CLOSED,
      consecutiveFailures: 0,
      cooldownStage: 0,
      openedAtMs: null,
      nextAttemptAtMs: null,
    };
  }

  private async readState(key: string): Promise<CircuitBreakerStateRecord> {
    if (!this.redisService) {
      return this.createClosedState();
    }

    const raw = await this.redisService.getClient().get(key);
    if (!raw) {
      return this.createClosedState();
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (this.isValidStateRecord(parsed)) {
        return parsed;
      }
    } catch {
      return this.createClosedState();
    }

    return this.createClosedState();
  }

  private isValidStateRecord(value: unknown): value is CircuitBreakerStateRecord {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const record = value as Record<string, unknown>;
    return (
      typeof record.state === 'string' &&
      this.isValidState(record.state) &&
      typeof record.consecutiveFailures === 'number' &&
      Number.isFinite(record.consecutiveFailures) &&
      record.consecutiveFailures >= 0 &&
      typeof record.cooldownStage === 'number' &&
      Number.isFinite(record.cooldownStage) &&
      record.cooldownStage >= 0 &&
      (record.openedAtMs === null || (typeof record.openedAtMs === 'number' && Number.isFinite(record.openedAtMs))) &&
      (record.nextAttemptAtMs === null ||
        (typeof record.nextAttemptAtMs === 'number' && Number.isFinite(record.nextAttemptAtMs)))
    );
  }

  private isValidState(value: string): value is CircuitBreakerState {
    return VALID_CIRCUIT_BREAKER_STATES.includes(value);
  }

  private parseRecordFailureLuaResult(raw: unknown): CircuitBreakerFailureResult {
    if (!Array.isArray(raw) || raw.length < 6) {
      throw new Error('Invalid circuit breaker recordFailure Lua response.');
    }

    const previousStateRaw = String(raw[0]);
    const currentStateRaw = String(raw[1]);

    if (!this.isValidState(previousStateRaw) || !this.isValidState(currentStateRaw)) {
      throw new Error('Invalid circuit breaker state returned by recordFailure Lua script.');
    }

    const opened = Number(raw[2]) === 1;
    const retryAfterRaw = Number(raw[3]);
    const consecutiveFailures = Number(raw[4]);
    const cooldownStage = Number(raw[5]);

    if (!Number.isFinite(consecutiveFailures) || !Number.isFinite(cooldownStage)) {
      throw new Error('Invalid circuit breaker counters returned by recordFailure Lua script.');
    }

    const retryAfterSeconds =
      Number.isFinite(retryAfterRaw) && retryAfterRaw > 0 ? Math.ceil(retryAfterRaw) : undefined;

    return {
      previousState: previousStateRaw,
      currentState: currentStateRaw,
      opened,
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      consecutiveFailures,
      cooldownStage,
    };
  }

  private async writeState(key: string, record: CircuitBreakerStateRecord, stateTtlSeconds: number): Promise<void> {
    if (!this.redisService) {
      return;
    }

    await this.redisService.getClient().set(key, JSON.stringify(record), 'EX', stateTtlSeconds);
  }

  private async acquireProbeLock(key: string, probeLockTtlSeconds: number): Promise<boolean> {
    if (!this.redisService) {
      return true;
    }

    const result = await this.redisService
      .getClient()
      .set(this.buildProbeKey(key), CIRCUIT_BREAKER_PROBE_LOCK_VALUE, 'EX', probeLockTtlSeconds, 'NX');

    return result === CIRCUIT_BREAKER_REDIS_SET_OK;
  }

  private async releaseProbeLock(key: string): Promise<void> {
    if (!this.redisService) {
      return;
    }

    await this.redisService.getClient().del(this.buildProbeKey(key));
  }

  private buildProbeKey(key: string): string {
    return `${key}${CIRCUIT_BREAKER_PROBE_KEY_SUFFIX}`;
  }

  private resolveCooldowns(cooldownSeconds: readonly number[]): readonly number[] {
    return cooldownSeconds.length > 0 ? cooldownSeconds : DEFAULT_CIRCUIT_BREAKER_COOLDOWN_SECONDS;
  }

  private resolveStateTtlSeconds(stateTtlSeconds?: number): number {
    return stateTtlSeconds ?? DEFAULT_CIRCUIT_BREAKER_STATE_TTL_SECONDS;
  }

  private resolveProbeLockTtlSeconds(probeLockTtlSeconds?: number): number {
    return probeLockTtlSeconds ?? DEFAULT_CIRCUIT_BREAKER_PROBE_LOCK_TTL_SECONDS;
  }

  private logRedisError(key: string, error: unknown): void {
    this.logger.warn({
      event: CircuitBreakerLogEvents.REDIS_ERROR,
      key,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

export type { CircuitBreakerState };
