import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { RedisService } from '@/database/redis/redis.service';
import {
  BeginEmailVerificationResendMutationResult,
  CompleteEmailVerificationLogicalSendInput,
  EmailVerificationResendState,
  IEmailVerificationResendStateStore,
} from '@/modules/auth/application/ports/email-verification-resend-state-store.interface';
import {
  EMAIL_VERIFICATION_INITIAL_COOLDOWN_SECONDS,
  EMAIL_VERIFICATION_MANUAL_RESEND_LIMIT,
  EMAIL_VERIFICATION_MANUAL_RESEND_WINDOW_SECONDS,
  EMAIL_VERIFICATION_MAX_COOLDOWN_SECONDS,
  EMAIL_VERIFICATION_MUTATION_TTL_SECONDS,
  EmailVerificationChallengeOrigin,
  EmailVerificationResendRestriction,
  NewEmailVerificationChallengeOrigin,
} from '@/modules/auth/domain/constants/email-verification.constants';
import { ABORT_EMAIL_VERIFICATION_RESEND_MUTATION_SCRIPT } from '@/modules/auth/infrastructure/cache/scripts/abort-email-verification-resend-mutation.script';
import { BEGIN_EMAIL_VERIFICATION_RESEND_MUTATION_SCRIPT } from '@/modules/auth/infrastructure/cache/scripts/begin-email-verification-resend-mutation.script';
import { COMPLETE_EMAIL_VERIFICATION_LOGICAL_SEND_SCRIPT } from '@/modules/auth/infrastructure/cache/scripts/complete-email-verification-logical-send.script';
import { LOAD_EMAIL_VERIFICATION_RESEND_STATE_SCRIPT } from '@/modules/auth/infrastructure/cache/scripts/load-email-verification-resend-state.script';
import { Injectable } from '@nestjs/common';

type RedisScriptValue = string | number | null;

const milliseconds = (seconds: number): number => seconds * 1_000;

@Injectable()
export class RedisEmailVerificationResendStateStore implements IEmailVerificationResendStateStore {
  constructor(private readonly redis: RedisService) {}

  async load(userId: string, now: Date): Promise<EmailVerificationResendState> {
    const keys = this.keys(userId);
    const rawResult = await this.redis
      .getClient()
      .eval(
        LOAD_EMAIL_VERIFICATION_RESEND_STATE_SCRIPT,
        keys.length,
        ...keys,
        now.getTime(),
        milliseconds(EMAIL_VERIFICATION_MANUAL_RESEND_WINDOW_SECONDS),
        EMAIL_VERIFICATION_MANUAL_RESEND_LIMIT,
      );
    const values = this.parseArray(rawResult, 'load');
    const status = this.parseInteger(values[0], 'load status');

    if (status === 0) {
      this.assertLength(values, 4, 'available load');
      const manualResendsUsed = this.parseManualCount(values[1]);

      return {
        kind: 'AVAILABLE',
        manualResendsUsed,
        manualResendsRemaining: this.parseRemaining(values[2], manualResendsUsed),
        lastLogicalSendAt: this.parseLastLogicalSendAt(values[3]),
      };
    }

    if (status === 1) {
      this.assertLength(values, 6, 'blocked load');
      const manualResendsUsed = this.parseManualCount(values[3]);

      return {
        kind: 'BLOCKED',
        blockedBy: this.parseRestriction(values[1]),
        retryAfterSeconds: this.parseRetryAfterSeconds(values[2]),
        manualResendsUsed,
        manualResendsRemaining: this.parseRemaining(values[4], manualResendsUsed),
        lastLogicalSendAt: this.parseLastLogicalSendAt(values[5]),
      };
    }

    throw new Error('Invalid email verification resend load status from Redis.');
  }

  async beginMutation(
    userId: string,
    mutationToken: string,
    now: Date,
  ): Promise<BeginEmailVerificationResendMutationResult> {
    const keys = this.keys(userId);
    const rawResult = await this.redis
      .getClient()
      .eval(
        BEGIN_EMAIL_VERIFICATION_RESEND_MUTATION_SCRIPT,
        3,
        keys[0],
        keys[1],
        keys[3],
        now.getTime(),
        milliseconds(EMAIL_VERIFICATION_MANUAL_RESEND_WINDOW_SECONDS),
        EMAIL_VERIFICATION_MANUAL_RESEND_LIMIT,
        mutationToken,
        milliseconds(EMAIL_VERIFICATION_MUTATION_TTL_SECONDS),
      );
    const values = this.parseArray(rawResult, 'begin mutation');
    const status = this.parseInteger(values[0], 'begin mutation status');

    if (status === 0) {
      this.assertLength(values, 2, 'acquired mutation');

      return {
        kind: 'ACQUIRED',
        manualResendsUsed: this.parseManualCount(values[1]),
      };
    }

    if (status === 1) {
      this.assertLength(values, 4, 'blocked mutation');

      return {
        kind: 'BLOCKED',
        blockedBy: this.parseRestriction(values[1]),
        retryAfterSeconds: this.parseRetryAfterSeconds(values[2]),
        manualResendsUsed: this.parseManualCount(values[3]),
      };
    }

    throw new Error('Invalid email verification resend mutation status from Redis.');
  }

  async completeLogicalSend(input: CompleteEmailVerificationLogicalSendInput): Promise<void> {
    const keys = this.keys(input.userId);
    const rawResult = await this.redis
      .getClient()
      .eval(
        COMPLETE_EMAIL_VERIFICATION_LOGICAL_SEND_SCRIPT,
        keys.length,
        ...keys,
        input.now.getTime(),
        input.origin,
        input.challengeId,
        input.logicalSendAt.getTime(),
        milliseconds(EMAIL_VERIFICATION_MANUAL_RESEND_WINDOW_SECONDS),
        milliseconds(EMAIL_VERIFICATION_INITIAL_COOLDOWN_SECONDS),
        milliseconds(EMAIL_VERIFICATION_MAX_COOLDOWN_SECONDS),
        input.mutationToken ?? '',
      );
    const values = this.parseArray(rawResult, 'complete logical send');

    this.assertLength(values, 4, 'complete logical send');
    if (this.parseInteger(values[0], 'complete logical send status') !== 0) {
      throw new Error('Invalid email verification logical send completion status from Redis.');
    }
    this.parseManualCount(values[1]);
    this.parseNonNegativeInteger(values[2], 'cooldown until');
    this.parseNonNegativeInteger(values[3], 'cooldown remaining');
  }

  async abortMutation(userId: string, mutationToken: string): Promise<void> {
    const rawResult = await this.redis
      .getClient()
      .eval(
        ABORT_EMAIL_VERIFICATION_RESEND_MUTATION_SCRIPT,
        1,
        CacheKeys.auth.emailVerification.pending(userId),
        mutationToken,
      );
    const values = this.parseArray(rawResult, 'abort mutation');

    this.assertLength(values, 1, 'abort mutation');
    const removed = this.parseInteger(values[0], 'abort mutation status');
    if (removed !== 0 && removed !== 1) {
      throw new Error('Invalid email verification mutation abort status from Redis.');
    }
  }

  private keys(userId: string): [string, string, string, string] {
    return [
      CacheKeys.auth.emailVerification.manualResends(userId),
      CacheKeys.auth.emailVerification.cooldown(userId),
      CacheKeys.auth.emailVerification.lastSend(userId),
      CacheKeys.auth.emailVerification.pending(userId),
    ];
  }

  private parseArray(value: unknown, operation: string): RedisScriptValue[] {
    if (!Array.isArray(value)) {
      throw new Error(`Invalid email verification Redis ${operation} response.`);
    }

    return value as RedisScriptValue[];
  }

  private assertLength(values: RedisScriptValue[], expected: number, operation: string): void {
    if (values.length !== expected) {
      throw new Error(`Invalid email verification Redis ${operation} response length.`);
    }
  }

  private parseInteger(value: RedisScriptValue | undefined, field: string): number {
    const parsed = Number(value);

    if (!Number.isSafeInteger(parsed)) {
      throw new Error(`Invalid email verification Redis ${field}.`);
    }

    return parsed;
  }

  private parseNonNegativeInteger(value: RedisScriptValue | undefined, field: string): number {
    const parsed = this.parseInteger(value, field);

    if (parsed < 0) {
      throw new Error(`Invalid email verification Redis ${field}.`);
    }

    return parsed;
  }

  private parseManualCount(value: RedisScriptValue | undefined): number {
    const count = this.parseNonNegativeInteger(value, 'manual resend count');

    if (count > EMAIL_VERIFICATION_MANUAL_RESEND_LIMIT) {
      throw new Error('Invalid email verification Redis manual resend count.');
    }

    return count;
  }

  private parseRemaining(value: RedisScriptValue | undefined, manualResendsUsed: number): number {
    const remaining = this.parseNonNegativeInteger(value, 'manual resend remaining');

    if (remaining !== EMAIL_VERIFICATION_MANUAL_RESEND_LIMIT - manualResendsUsed) {
      throw new Error('Inconsistent email verification Redis manual resend remaining count.');
    }

    return remaining;
  }

  private parseRetryAfterSeconds(value: RedisScriptValue | undefined): number {
    const retryAfterMs = this.parseInteger(value, 'retry after');

    if (retryAfterMs <= 0) {
      throw new Error('Invalid email verification Redis retry after.');
    }

    return Math.max(1, Math.ceil(retryAfterMs / 1_000));
  }

  private parseRestriction(value: RedisScriptValue | undefined): EmailVerificationResendRestriction {
    switch (this.parseInteger(value, 'restriction')) {
      case 1:
        return EmailVerificationResendRestriction.COOLDOWN;
      case 2:
        return EmailVerificationResendRestriction.DAILY_LIMIT;
      case 3:
        return EmailVerificationResendRestriction.OPERATION_PENDING;
      default:
        throw new Error('Invalid email verification Redis restriction.');
    }
  }

  private parseLastLogicalSendAt(value: RedisScriptValue | undefined): Date | null {
    if (value === '') {
      return null;
    }

    if (typeof value !== 'string') {
      throw new Error('Invalid email verification Redis last send value.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      throw new Error('Invalid email verification Redis last send JSON.');
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Invalid email verification Redis last send payload.');
    }

    const record = parsed as Record<string, unknown>;
    if (typeof record.challengeId !== 'string' || !record.challengeId.trim()) {
      throw new Error('Invalid email verification Redis last send challenge id.');
    }
    if (!this.isLogicalSendOrigin(record.origin)) {
      throw new Error('Invalid email verification Redis last send origin.');
    }
    if (!Number.isSafeInteger(record.logicalSendAtMs)) {
      throw new Error('Invalid email verification Redis last send timestamp.');
    }

    const logicalSendAt = new Date(record.logicalSendAtMs as number);
    if (Number.isNaN(logicalSendAt.getTime())) {
      throw new Error('Invalid email verification Redis last send timestamp.');
    }

    return logicalSendAt;
  }

  private isLogicalSendOrigin(value: unknown): value is NewEmailVerificationChallengeOrigin {
    return (
      value === EmailVerificationChallengeOrigin.AUTOMATIC ||
      value === EmailVerificationChallengeOrigin.MANUAL_RESEND
    );
  }
}
