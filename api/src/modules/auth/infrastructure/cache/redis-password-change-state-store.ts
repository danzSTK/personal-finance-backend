import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { RedisService } from '@/database/redis/redis.service';
import {
  IPasswordChangeStateStore,
  PasswordChangeMutationStartResult,
  PasswordChangeStateLoadResult,
  PasswordChangeStateLoadResultKind,
  PasswordChangeStateProjection,
} from '@/modules/auth/application/ports/password-change-state-store.interface';
import {
  PASSWORD_CHANGE_BLOCK_RECURRENCE_WINDOW_MS,
  PASSWORD_CHANGE_COMPLETED_WINDOW_MS,
  PASSWORD_CHANGE_FAILURE_WINDOW_MS,
  PASSWORD_CHANGE_STATE_INITIALIZED_TTL_MS,
} from '@/modules/auth/domain/constants/password-change.constants';
import { LOAD_PASSWORD_CHANGE_STATE_SCRIPT } from '@/modules/auth/infrastructure/cache/scripts/load-password-change-state.script';
import {
  BEGIN_PASSWORD_CHANGE_MUTATION_SCRIPT,
  REPLACE_PASSWORD_CHANGE_STATE_SCRIPT,
} from '@/modules/auth/infrastructure/cache/scripts/replace-password-change-state.script';
import { Injectable } from '@nestjs/common';

type RedisScriptValue = string | number | null;

interface RedisProjectionPayload {
  failedAttempts: Array<{
    eventId: string;
    occurredAtMs: number;
  }>;

  completedChanges: Array<{
    eventId: string;
    occurredAtMs: number;
  }>;

  blockedUntilMs: number | null;
  lastBlockStartedAtMs: number | null;
}

@Injectable()
export class RedisPasswordChangeStateStore implements IPasswordChangeStateStore {
  constructor(private readonly redis: RedisService) {}
  async load(userId: string, now: Date): Promise<PasswordChangeStateLoadResult> {
    const keys = this.keys(userId);

    const rawResult = await this.redis
      .getClient()
      .eval(
        LOAD_PASSWORD_CHANGE_STATE_SCRIPT,
        keys.length,
        ...keys,
        now.getTime(),
        PASSWORD_CHANGE_FAILURE_WINDOW_MS,
        PASSWORD_CHANGE_COMPLETED_WINDOW_MS,
      );

    if (!Array.isArray(rawResult)) {
      throw new Error('Invalid password change state response from Redis.');
    }

    const values = rawResult as RedisScriptValue[];
    const status = Number(values[0]);

    if (status === 0) {
      return {
        kind: PasswordChangeStateLoadResultKind.MISSING,
      };
    }

    if (status === 2) {
      return {
        kind: PasswordChangeStateLoadResultKind.PENDING,
        retryAfterSeconds: Math.max(1, Math.ceil(Number(values[1]) / 1_000)),
      };
    }

    if (status !== 1) {
      throw new Error('Unknown password change Redis state.');
    }

    return {
      kind: PasswordChangeStateLoadResultKind.READY,
      state: {
        blockedUntil: this.parseOptionalDate(values[1]),
        lastBlockStartedAt: this.parseOptionalDate(values[2]),
        failedAttemptsInWindow: Number(values[3]),
        completedChangesAt: values.slice(4).map(value => this.parseRequiredDate(value)),
      },
    };
  }

  async beginMutation(
    userId: string,
    mutationToken: string,
    ttlMs: number,
  ): Promise<PasswordChangeMutationStartResult> {
    const rawResult = await this.redis
      .getClient()
      .eval(
        BEGIN_PASSWORD_CHANGE_MUTATION_SCRIPT,
        2,
        CacheKeys.auth.passwordChange.initialized(userId),
        CacheKeys.auth.passwordChange.pending(userId),
        mutationToken,
        ttlMs,
      );

    if (!Array.isArray(rawResult)) {
      throw new Error('Invalid password change mutation response from Redis.');
    }

    const status = Number(rawResult[0]);

    if (status === 1) {
      return { acquired: true };
    }

    if (status === 0) {
      return {
        acquired: false,
        retryAfterSeconds: Math.max(1, Math.ceil(Number(rawResult[1]) / 1_000)),
      };
    }

    throw new Error('Unknown password change mutation state.');
  }

  async replace(
    userId: string,
    projection: PasswordChangeStateProjection,
    now: Date,
    mutationToken?: string,
  ): Promise<void> {
    const keys = this.keys(userId);
    const payload = this.toPayload(projection);

    await this.redis
      .getClient()
      .eval(
        REPLACE_PASSWORD_CHANGE_STATE_SCRIPT,
        keys.length,
        ...keys,
        JSON.stringify(payload),
        now.getTime(),
        PASSWORD_CHANGE_FAILURE_WINDOW_MS,
        PASSWORD_CHANGE_COMPLETED_WINDOW_MS,
        PASSWORD_CHANGE_BLOCK_RECURRENCE_WINDOW_MS,
        PASSWORD_CHANGE_STATE_INITIALIZED_TTL_MS,
        mutationToken ?? '',
      );
  }

  async clear(userId: string): Promise<void> {
    await this.redis.getClient().del(...this.keys(userId));
  }

  private parseOptionalDate(value: RedisScriptValue): Date | null {
    if (value === '' || value === null) {
      return null;
    }

    return this.parseRequiredDate(value);
  }

  private parseRequiredDate(value: RedisScriptValue): Date {
    const milliseconds = Number(value);
    const date = new Date(milliseconds);

    if (!Number.isFinite(milliseconds) || Number.isNaN(date.getTime())) {
      throw new Error('Invalid date stored in password change Redis state.');
    }

    return date;
  }

  private toPayload(projection: PasswordChangeStateProjection): RedisProjectionPayload {
    return {
      failedAttempts: projection.failedAttempts.map(entry => ({
        eventId: entry.eventId,
        occurredAtMs: entry.occurredAt.getTime(),
      })),
      completedChanges: projection.completedChanges.map(entry => ({
        eventId: entry.eventId,
        occurredAtMs: entry.occurredAt.getTime(),
      })),
      blockedUntilMs: projection.blockedUntil?.getTime() ?? null,
      lastBlockStartedAtMs: projection.lastBlockStartedAt?.getTime() ?? null,
    };
  }

  private keys(userId: string): string[] {
    return [
      CacheKeys.auth.passwordChange.failures(userId),
      CacheKeys.auth.passwordChange.block(userId),
      CacheKeys.auth.passwordChange.blockRecurrence(userId),
      CacheKeys.auth.passwordChange.changes(userId),
      CacheKeys.auth.passwordChange.initialized(userId),
      CacheKeys.auth.passwordChange.pending(userId),
    ];
  }
}
