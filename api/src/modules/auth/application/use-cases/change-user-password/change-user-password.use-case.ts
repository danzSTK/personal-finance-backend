import { IHashService } from '@/common/models/interfaces';
import {
  CurrentPasswordInvalidError,
  NewPasswordMustDifferError,
  PasswordChangeBlockedError,
  PasswordChangeCooldownActiveError,
  PasswordChangeDailyLimitExceededError,
  PasswordChangeEmailProviderRequiredError,
  PasswordChangeOperationPendingError,
  PasswordChangeStateUnavailableError,
} from '@/modules/auth/application/errors';
import { IPasswordChangeStateStore } from '@/modules/auth/application/ports/password-change-state-store.interface';
import { PasswordChangeStateLoader } from '@/modules/auth/application/services/password-change-state-loader';
import { PasswordChangeStateSynchronizer } from '@/modules/auth/application/services/password-change-state-synchronizer';
import {
  ChangeUserPasswordInput,
  ChangeUserPasswordOutput,
} from '@/modules/auth/application/use-cases/change-user-password/change-user-password.dto';
import {
  PASSWORD_CHANGE_EVENT_METADATA_KEYS,
  PASSWORD_CHANGE_MUTATION_PENDING_TTL_MS,
  PASSWORD_CHANGE_METADATA_VALUE_MAX_LENGTH,
  PASSWORD_CHANGE_USER_AGENT_MAX_LENGTH,
} from '@/modules/auth/domain/constants/password-change.constants';
import { PasswordChangeEvent } from '@/modules/auth/domain/entities/password-change-event.entity';
import { PasswordChangeBlockStartedEvent } from '@/modules/auth/domain/events/password-change-block-started.event';
import { PasswordChangeSecurityContext } from '@/modules/auth/domain/events/password-change-security-context';
import { PasswordChangeStateRefreshRequestedEvent } from '@/modules/auth/domain/events/password-change-state-refresh-requested.event';
import { PasswordChangedEvent } from '@/modules/auth/domain/events/password-changed.event';
import { UserSessionsRevokeAllRequestedEvent } from '@/modules/auth/domain/events/user-sessions-revoke-all-requested.event';
import {
  ChangePasswordPolicy,
  PasswordChangePolicyDecision,
  PasswordChangeRestrictionReason,
  PasswordChangeState,
} from '@/modules/auth/domain/policies/change-password.policy';
import { IPasswordChangeEventRepository } from '@/modules/auth/domain/repositories/password-change-event.repository.interface';
import { ISessionRepository } from '@/modules/auth/domain/repositories/session.repository.interface';
import { UserNotFoundError } from '@/modules/users/application/errors';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { HashedPassword } from '@/modules/users/domain/value-objects/hashed-password.value-object';
import { OutboxWriteService } from '@/shared/outbox/services/outbox-write.service';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';

type ChangePasswordTransactionResult =
  | {
      kind: 'CHANGED';
    }
  | {
      kind: 'CURRENT_PASSWORD_INVALID';
    }
  | {
      kind: 'BLOCKED';
      retryAfterSeconds: number;
    };

@Injectable()
export class ChangeUserPasswordUseCase {
  private readonly logger = new Logger(ChangeUserPasswordUseCase.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly userRepository: IUserRepository,
    private readonly eventRepository: IPasswordChangeEventRepository,
    private readonly stateStore: IPasswordChangeStateStore,
    private readonly stateLoader: PasswordChangeStateLoader,
    private readonly stateSynchronizer: PasswordChangeStateSynchronizer,
    private readonly policy: ChangePasswordPolicy,
    private readonly hashService: IHashService,
    private readonly sessionRepository: ISessionRepository,
    private readonly outboxWriteService: OutboxWriteService,
  ) {}

  async execute(input: ChangeUserPasswordInput): Promise<ChangeUserPasswordOutput> {
    const now = new Date();
    const operationalState = await this.stateLoader.load(input.userId, now);
    const restriction = this.policy.evaluateRestrictions(operationalState.state, now);

    if (!restriction.allowed) {
      throw this.toRestrictionError(restriction);
    }

    const mutationToken = randomUUID();
    const mutation = await this.beginMutation(input.userId, mutationToken);

    if (!mutation.acquired) {
      throw new PasswordChangeOperationPendingError(mutation.retryAfterSeconds);
    }

    let result: ChangePasswordTransactionResult;

    try {
      result = await this.dataSource.transaction(manager =>
        this.executeTransaction(input, operationalState.state, now, mutationToken, manager),
      );
    } finally {
      await this.synchronizeState(input.userId, now, mutationToken);
    }

    if (result.kind === 'CURRENT_PASSWORD_INVALID') {
      throw new CurrentPasswordInvalidError();
    }

    if (result.kind === 'BLOCKED') {
      throw new PasswordChangeBlockedError(result.retryAfterSeconds);
    }

    await this.revokeSessions(input.userId);

    return {
      status: 'CHANGED',
    };
  }

  private async executeTransaction(
    input: ChangeUserPasswordInput,
    state: PasswordChangeState,
    now: Date,
    mutationToken: string,
    manager: EntityManager,
  ): Promise<ChangePasswordTransactionResult> {
    const user = await this.userRepository.findByIdForUpdate(input.userId, { manager });

    if (!user) {
      throw new UserNotFoundError();
    }

    const credentialsProvider = user.getCredentialsAuthProvider();

    if (!credentialsProvider) {
      throw new PasswordChangeEmailProviderRequiredError();
    }

    const currentPasswordIsValid = await this.hashService.compare(
      input.currentPassword,
      credentialsProvider.passwordHash.value,
    );

    if (!currentPasswordIsValid) {
      return this.recordCurrentPasswordFailure(input, credentialsProvider.id, state, now, mutationToken, manager);
    }

    if (input.currentPassword === input.newPassword) {
      throw new NewPasswordMustDifferError();
    }

    const passwordHash = await this.hashService.hash(input.newPassword);
    credentialsProvider.changePasswordHash(HashedPassword.reconstitute(passwordHash), now);
    user.incrementCredentialVersion(now);

    await this.userRepository.save(user, { manager });

    const passwordChanged = PasswordChangeEvent.passwordChanged(
      this.toEventContext(input, credentialsProvider.id, now),
      randomUUID(),
    );

    await this.eventRepository.save(passwordChanged, { manager });

    await this.outboxWriteService.storeEvents(
      [
        PasswordChangeStateRefreshRequestedEvent.create(input.userId, passwordChanged.id, now, mutationToken),
        PasswordChangedEvent.create(input.userId, passwordChanged.id, this.toSecurityContext(input), now),
        UserSessionsRevokeAllRequestedEvent.create(input.userId, passwordChanged.id, now),
      ],
      { manager },
    );

    return { kind: 'CHANGED' };
  }

  private async recordCurrentPasswordFailure(
    input: ChangeUserPasswordInput,
    authProviderId: string,
    state: PasswordChangeState,
    now: Date,
    mutationToken: string,
    manager: EntityManager,
  ): Promise<ChangePasswordTransactionResult> {
    const failure = PasswordChangeEvent.currentPasswordFailed(
      this.toEventContext(input, authProviderId, now),
      randomUUID(),
    );
    const blockDecision = this.policy.evaluateFailedAttempts(state, now);
    const events = [failure];

    if (!blockDecision.shouldStartBlock) {
      await this.eventRepository.saveAll(events, { manager });
      await this.outboxWriteService.storeEvents(
        [PasswordChangeStateRefreshRequestedEvent.create(input.userId, failure.id, now, mutationToken)],
        { manager },
      );

      return { kind: 'CURRENT_PASSWORD_INVALID' };
    }

    const block = PasswordChangeEvent.failedAttemptsBlockStarted(
      {
        ...this.toEventContext(input, authProviderId, now),
        blockedUntil: blockDecision.blockedUntil,
      },
      randomUUID(),
    );
    events.push(block);

    await this.eventRepository.saveAll(events, { manager });
    await this.outboxWriteService.storeEvents(
      [
        PasswordChangeStateRefreshRequestedEvent.create(input.userId, block.id, now, mutationToken),
        PasswordChangeBlockStartedEvent.create(
          input.userId,
          block.id,
          blockDecision.blockedUntil,
          this.toSecurityContext(input),
          now,
        ),
      ],
      { manager },
    );

    return {
      kind: 'BLOCKED',
      retryAfterSeconds: Math.max(1, Math.ceil((blockDecision.blockedUntil.getTime() - now.getTime()) / 1_000)),
    };
  }

  private async beginMutation(userId: string, mutationToken: string) {
    try {
      return await this.stateStore.beginMutation(userId, mutationToken, PASSWORD_CHANGE_MUTATION_PENDING_TTL_MS);
    } catch {
      throw new PasswordChangeStateUnavailableError();
    }
  }

  private async synchronizeState(userId: string, now: Date, mutationToken: string): Promise<void> {
    try {
      await this.stateSynchronizer.synchronize(userId, now, mutationToken);
    } catch (error) {
      this.logger.error(
        `Password change state synchronization failed userId=${userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async revokeSessions(userId: string): Promise<void> {
    try {
      await this.sessionRepository.revokeAllSessions(userId);
    } catch (error) {
      this.logger.error(
        `Password changed but physical session cleanup failed userId=${userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private toRestrictionError(
    decision: Exclude<PasswordChangePolicyDecision, { allowed: true }>,
  ): PasswordChangeBlockedError | PasswordChangeCooldownActiveError | PasswordChangeDailyLimitExceededError {
    switch (decision.reason) {
      case PasswordChangeRestrictionReason.FAILED_ATTEMPTS_BLOCK:
        return new PasswordChangeBlockedError(decision.retryAfterSeconds);
      case PasswordChangeRestrictionReason.COOLDOWN:
        return new PasswordChangeCooldownActiveError(decision.retryAfterSeconds);
      case PasswordChangeRestrictionReason.DAILY_LIMIT:
        return new PasswordChangeDailyLimitExceededError(decision.retryAfterSeconds);
    }
  }

  private toEventContext(input: ChangeUserPasswordInput, authProviderId: string, occurredAt: Date) {
    return {
      userId: input.userId,
      authProviderId,
      sessionId: input.sessionId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent?.slice(0, PASSWORD_CHANGE_USER_AGENT_MAX_LENGTH) ?? null,
      metadata: this.sanitizeMetadata(input.metadata),
      occurredAt,
    };
  }

  private toSecurityContext(input: ChangeUserPasswordInput): PasswordChangeSecurityContext {
    const metadata = this.sanitizeMetadata(input.metadata);

    return {
      ipAddress: input.ipAddress,
      location: metadata.location ?? null,
      browser: metadata.browser ?? null,
      operatingSystem: metadata.operatingSystem ?? metadata.os ?? null,
      device: metadata.device ?? null,
    };
  }

  private sanitizeMetadata(metadata: ChangeUserPasswordInput['metadata']): ChangeUserPasswordInput['metadata'] {
    const allowedKeys = new Set<string>(PASSWORD_CHANGE_EVENT_METADATA_KEYS);

    return Object.fromEntries(
      Object.entries(metadata)
        .filter((entry): entry is [string, string] => allowedKeys.has(entry[0]) && typeof entry[1] === 'string')
        .map(([key, value]) => [key, value.slice(0, PASSWORD_CHANGE_METADATA_VALUE_MAX_LENGTH)]),
    );
  }
}
