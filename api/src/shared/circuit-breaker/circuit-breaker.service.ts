import { RedisService } from '@/database/redis/redis.service';
import {
  CIRCUIT_BREAKER_PROBE_KEY_SUFFIX,
  CIRCUIT_BREAKER_PROBE_LOCK_VALUE,
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
      const record = await this.readState(options.key);
      await this.releaseProbeLock(options.key);

      const now = Date.now();
      const cooldowns = this.resolveCooldowns(options.cooldownSeconds);
      const stateTtlSeconds = this.resolveStateTtlSeconds(options.stateTtlSeconds);
      const failureThreshold = Math.max(1, options.failureThreshold);
      const previousState = record.state;

      if (previousState === CircuitBreakerStates.HALF_OPEN) {
        const nextStage = Math.min(record.cooldownStage + 1, cooldowns.length - 1);
        const cooldown = cooldowns[nextStage];
        const consecutiveFailures = record.consecutiveFailures + 1;

        const nextRecord: CircuitBreakerStateRecord = {
          state: CircuitBreakerStates.OPEN,
          consecutiveFailures,
          cooldownStage: nextStage,
          openedAtMs: now,
          nextAttemptAtMs: now + cooldown * 1000,
        };

        await this.writeState(options.key, nextRecord, stateTtlSeconds);
        this.logger.warn({
          event: CircuitBreakerLogEvents.CIRCUIT_OPENED,
          key: options.key,
          previousState,
          consecutiveFailures,
          cooldownStage: nextStage,
          retryAfterSeconds: cooldown,
        });

        return {
          previousState,
          currentState: CircuitBreakerStates.OPEN,
          opened: true,
          retryAfterSeconds: cooldown,
          consecutiveFailures,
          cooldownStage: nextStage,
        };
      }

      if (previousState === CircuitBreakerStates.CLOSED) {
        const consecutiveFailures = record.consecutiveFailures + 1;

        if (consecutiveFailures >= failureThreshold) {
          const cooldownStage = 0;
          const cooldown = cooldowns[cooldownStage];

          const nextRecord: CircuitBreakerStateRecord = {
            state: CircuitBreakerStates.OPEN,
            consecutiveFailures,
            cooldownStage,
            openedAtMs: now,
            nextAttemptAtMs: now + cooldown * 1000,
          };

          await this.writeState(options.key, nextRecord, stateTtlSeconds);
          this.logger.warn({
            event: CircuitBreakerLogEvents.CIRCUIT_OPENED,
            key: options.key,
            previousState,
            consecutiveFailures,
            cooldownStage,
            retryAfterSeconds: cooldown,
          });

          return {
            previousState,
            currentState: CircuitBreakerStates.OPEN,
            opened: true,
            retryAfterSeconds: cooldown,
            consecutiveFailures,
            cooldownStage,
          };
        }

        const nextRecord: CircuitBreakerStateRecord = {
          ...record,
          state: CircuitBreakerStates.CLOSED,
          consecutiveFailures,
        };

        await this.writeState(options.key, nextRecord, stateTtlSeconds);

        return {
          previousState,
          currentState: CircuitBreakerStates.CLOSED,
          opened: false,
          consecutiveFailures,
          cooldownStage: record.cooldownStage,
        };
      }

      const retryAfterSeconds =
        record.nextAttemptAtMs !== null && record.nextAttemptAtMs > now
          ? Math.max(1, Math.ceil((record.nextAttemptAtMs - now) / 1000))
          : undefined;

      return {
        previousState,
        currentState: CircuitBreakerStates.OPEN,
        opened: false,
        ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
        consecutiveFailures: record.consecutiveFailures,
        cooldownStage: record.cooldownStage,
      };
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
      VALID_CIRCUIT_BREAKER_STATES.includes(record.state) &&
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
