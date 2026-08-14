/* eslint-disable @typescript-eslint/unbound-method */
import { Email } from '@/common/domain/value-objects/email.value-object';
import { AuthProviderType, UserStatus } from '@/common/models/enums';
import { IHashService } from '@/common/models/interfaces';
import {
  CurrentPasswordInvalidError,
  NewPasswordMustDifferError,
  PasswordChangeBlockedError,
  PasswordChangeCooldownActiveError,
  PasswordChangeDailyLimitExceededError,
  PasswordChangeEmailProviderRequiredError,
  PasswordChangeOperationPendingError,
} from '@/modules/auth/application/errors';
import { IPasswordChangeStateStore } from '@/modules/auth/application/ports/password-change-state-store.interface';
import { PasswordChangeStateLoader } from '@/modules/auth/application/services/password-change-state-loader';
import { PasswordChangeStateSynchronizer } from '@/modules/auth/application/services/password-change-state-synchronizer';
import { ChangeUserPasswordUseCase } from '@/modules/auth/application/use-cases/change-user-password/change-user-password.use-case';
import {
  PASSWORD_CHANGE_COMPLETED_WINDOW_MS,
  PASSWORD_CHANGE_COOLDOWN_MS,
  PASSWORD_CHANGE_MUTATION_PENDING_TTL_MS,
  PasswordChangeEventType,
} from '@/modules/auth/domain/constants/password-change.constants';
import { PasswordChangeEvent } from '@/modules/auth/domain/entities/password-change-event.entity';
import { PasswordChangeBlockStartedEvent } from '@/modules/auth/domain/events/password-change-block-started.event';
import { PasswordChangedEvent } from '@/modules/auth/domain/events/password-changed.event';
import { UserSessionsRevokeAllRequestedEvent } from '@/modules/auth/domain/events/user-sessions-revoke-all-requested.event';
import { ChangePasswordPolicy } from '@/modules/auth/domain/policies/change-password.policy';
import { IPasswordChangeEventRepository } from '@/modules/auth/domain/repositories/password-change-event.repository.interface';
import { ISessionRepository } from '@/modules/auth/domain/repositories/session.repository.interface';
import { CredentialsAuthProvider } from '@/modules/users/domain/entities/credentials-auth-provider.entity';
import { User } from '@/modules/users/domain/entities/user.entity';
import { UserNotFoundError } from '@/modules/users/application/errors';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { HashedPassword } from '@/modules/users/domain/value-objects/hashed-password.value-object';
import { OutboxWriteService } from '@/shared/outbox/services/outbox-write.service';
import { Test } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';

describe('ChangeUserPasswordUseCase', () => {
  const now = new Date('2026-07-30T12:00:00.000Z');
  const userId = randomUUID();
  const providerId = randomUUID();
  const sessionId = randomUUID();
  const manager = {} as EntityManager;
  const input = {
    userId,
    currentPassword: 'current-password',
    newPassword: 'new-password',
    sessionId,
    ipAddress: '203.0.113.10',
    userAgent: 'Test Browser',
    metadata: {
      location: 'Fortaleza, CE, BR',
      browser: 'Test Browser',
      operatingSystem: 'Test OS',
      device: 'Desktop',
    },
  };
  const emptyState = {
    failedAttemptsInWindow: 0,
    blockedUntil: null,
    lastBlockStartedAt: null,
    completedChangesAt: [],
  };

  let useCase: ChangeUserPasswordUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let eventRepository: jest.Mocked<IPasswordChangeEventRepository>;
  let stateStore: jest.Mocked<IPasswordChangeStateStore>;
  let stateLoader: jest.Mocked<PasswordChangeStateLoader>;
  let synchronizer: jest.Mocked<PasswordChangeStateSynchronizer>;
  let hashService: jest.Mocked<IHashService>;
  let sessionRepository: jest.Mocked<ISessionRepository>;
  let outboxWriteService: jest.Mocked<OutboxWriteService>;
  let dataSource: { transaction: jest.Mock };

  const makeUser = (withCredentials = true): User => {
    const authProviders = withCredentials
      ? [
          CredentialsAuthProvider.create(
            {
              provider: AuthProviderType.EMAIL,
              providerUserId: 'user@example.com',
              passwordHash: HashedPassword.reconstitute('current-hash'),
              userId,
              createdAt: now,
              updatedAt: now,
            },
            providerId,
          ),
        ]
      : [];

    return User.reconstitute(
      {
        userName: null,
        firstName: null,
        lastName: null,
        email: Email.reconstitute('user@example.com'),
        status: UserStatus.ACTIVE,
        avatarAssetId: null,
        authProviders,
        credentialVersion: 1,
        createdAt: now,
        updatedAt: now,
      },
      userId,
    );
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(now);

    userRepository = {
      findById: jest.fn(),
      findByIdForUpdate: jest.fn(),
      findCredentialVersionById: jest.fn(),
      findByEmail: jest.fn(),
      findByUserName: jest.fn(),
      findByAuthProvider: jest.fn(),
      usernameAlreadyExists: jest.fn(),
      save: jest.fn(),
    };
    eventRepository = {
      findRelevantEvents: jest.fn(),
      findActiveBlock: jest.fn(),
      save: jest.fn(),
      saveAll: jest
        .fn()
        .mockImplementation((events: PasswordChangeEvent[]): Promise<PasswordChangeEvent[]> => Promise.resolve(events)),
    };
    stateStore = {
      load: jest.fn(),
      beginMutation: jest.fn().mockResolvedValue({ acquired: true }),
      replace: jest.fn(),
      clear: jest.fn(),
    };
    stateLoader = {
      load: jest.fn().mockResolvedValue({ state: emptyState }),
    } as unknown as jest.Mocked<PasswordChangeStateLoader>;
    synchronizer = {
      synchronize: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PasswordChangeStateSynchronizer>;
    hashService = {
      hash: jest.fn().mockResolvedValue('new-hash'),
      compare: jest.fn().mockResolvedValue(true),
    };
    sessionRepository = {
      createSession: jest.fn(),
      getSession: jest.fn(),
      revokeSession: jest.fn(),
      revokeAllSessions: jest.fn(),
      getActiveSessions: jest.fn(),
      sessionExists: jest.fn(),
      blacklistAccessToken: jest.fn(),
      isAccessTokenBlacklisted: jest.fn(),
    };
    outboxWriteService = {
      storeEvents: jest.fn(),
    } as unknown as jest.Mocked<OutboxWriteService>;
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          (callback: (transactionManager: EntityManager) => Promise<unknown>): Promise<unknown> => callback(manager),
        ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChangeUserPasswordUseCase,
        ChangePasswordPolicy,
        { provide: IUserRepository, useValue: userRepository },
        { provide: IPasswordChangeEventRepository, useValue: eventRepository },
        { provide: IPasswordChangeStateStore, useValue: stateStore },
        { provide: PasswordChangeStateLoader, useValue: stateLoader },
        { provide: PasswordChangeStateSynchronizer, useValue: synchronizer },
        { provide: IHashService, useValue: hashService },
        { provide: ISessionRepository, useValue: sessionRepository },
        { provide: OutboxWriteService, useValue: outboxWriteService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    useCase = moduleRef.get(ChangeUserPasswordUseCase);
    userRepository.findByIdForUpdate.mockResolvedValue(makeUser());
    userRepository.save.mockImplementation((user: User) => Promise.resolve(user));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('execute', () => {
    it('changes the hash, increments credential version and persists outbox events atomically', async () => {
      await expect(useCase.execute(input)).resolves.toEqual({ status: 'CHANGED' });

      const savedUser = userRepository.save.mock.calls[0][0];
      expect(savedUser.credentialVersion).toBe(2);
      expect(savedUser.getCredentialsAuthProvider()?.passwordHash.value).toBe('new-hash');
      expect(userRepository.save).toHaveBeenCalledWith(savedUser, { manager });
      expect(eventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: PasswordChangeEventType.PASSWORD_CHANGED,
        }),
        { manager },
      );
      const outboxEvents = outboxWriteService.storeEvents.mock.calls[0][0];
      expect(outboxEvents).toEqual(
        expect.arrayContaining([expect.any(PasswordChangedEvent), expect.any(UserSessionsRevokeAllRequestedEvent)]),
      );
      expect(outboxWriteService.storeEvents).toHaveBeenCalledWith(outboxEvents, { manager });
      expect(synchronizer.synchronize).toHaveBeenCalledWith(userId, now, expect.any(String));
      expect(sessionRepository.revokeAllSessions).toHaveBeenCalledWith(userId);
    });

    it('records a wrong current password and returns 403 without changing the hash', async () => {
      hashService.compare.mockResolvedValue(false);

      await expect(useCase.execute(input)).rejects.toBeInstanceOf(CurrentPasswordInvalidError);

      expect(eventRepository.saveAll).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            eventType: PasswordChangeEventType.CURRENT_PASSWORD_FAILED,
          }),
        ],
        { manager },
      );
      expect(hashService.hash).not.toHaveBeenCalled();
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(sessionRepository.revokeAllSessions).not.toHaveBeenCalled();
    });

    it('starts a block on the fifth wrong password and publishes the notification fact', async () => {
      hashService.compare.mockResolvedValue(false);
      stateLoader.load.mockResolvedValue({
        state: {
          ...emptyState,
          failedAttemptsInWindow: 4,
        },
      });

      await expect(useCase.execute(input)).rejects.toBeInstanceOf(PasswordChangeBlockedError);

      const savedEvents = eventRepository.saveAll.mock.calls[0][0];
      expect(savedEvents.map(event => event.eventType)).toEqual([
        PasswordChangeEventType.CURRENT_PASSWORD_FAILED,
        PasswordChangeEventType.FAILED_ATTEMPTS_BLOCK_STARTED,
      ]);
      expect(outboxWriteService.storeEvents.mock.calls[0][0]).toEqual(
        expect.arrayContaining([expect.any(PasswordChangeBlockStartedEvent)]),
      );
    });

    it('rejects an OAuth-only account without comparing a hash', async () => {
      userRepository.findByIdForUpdate.mockResolvedValue(makeUser(false));

      await expect(useCase.execute(input)).rejects.toBeInstanceOf(PasswordChangeEmailProviderRequiredError);
      expect(hashService.compare).not.toHaveBeenCalled();
    });

    it('rejects a missing user without comparing or recording a password failure', async () => {
      userRepository.findByIdForUpdate.mockResolvedValue(null);

      await expect(useCase.execute(input)).rejects.toBeInstanceOf(UserNotFoundError);
      expect(hashService.compare).not.toHaveBeenCalled();
      expect(eventRepository.saveAll).not.toHaveBeenCalled();
    });

    it('rejects an equal new password only after confirming the current password', async () => {
      await expect(
        useCase.execute({
          ...input,
          newPassword: input.currentPassword,
        }),
      ).rejects.toBeInstanceOf(NewPasswordMustDifferError);

      expect(hashService.compare).toHaveBeenCalledTimes(1);
      expect(eventRepository.saveAll).not.toHaveBeenCalled();
    });

    it('rejects an active user restriction before acquiring the barrier or comparing bcrypt', async () => {
      stateLoader.load.mockResolvedValue({
        state: {
          ...emptyState,
          blockedUntil: new Date(now.getTime() + 60_000),
        },
      });

      await expect(useCase.execute(input)).rejects.toBeInstanceOf(PasswordChangeBlockedError);
      expect(stateStore.beginMutation).not.toHaveBeenCalled();
      expect(hashService.compare).not.toHaveBeenCalled();
    });

    it.each([
      {
        name: 'cooldown',
        completedChangesAt: [new Date(now.getTime() - PASSWORD_CHANGE_COOLDOWN_MS + 1_000)],
        error: PasswordChangeCooldownActiveError,
      },
      {
        name: 'daily limit',
        completedChangesAt: [
          new Date(now.getTime() - 60 * 60_000),
          new Date(now.getTime() - 2 * 60 * 60_000),
          new Date(now.getTime() - PASSWORD_CHANGE_COMPLETED_WINDOW_MS + 60_000),
        ],
        error: PasswordChangeDailyLimitExceededError,
      },
    ])('rejects an active $name before bcrypt', async ({ completedChangesAt, error }) => {
      stateLoader.load.mockResolvedValue({
        state: {
          ...emptyState,
          completedChangesAt,
        },
      });

      await expect(useCase.execute(input)).rejects.toBeInstanceOf(error);
      expect(hashService.compare).not.toHaveBeenCalled();
    });

    it('returns the pending barrier PTTL when a concurrent request owns the mutation', async () => {
      stateStore.beginMutation.mockResolvedValue({
        acquired: false,
        retryAfterSeconds: 47,
      });

      await expect(useCase.execute(input)).rejects.toMatchObject<Partial<PasswordChangeOperationPendingError>>({
        retryAfterSeconds: 47,
      });
      expect(stateStore.beginMutation).toHaveBeenCalledWith(
        userId,
        expect.any(String),
        PASSWORD_CHANGE_MUTATION_PENDING_TTL_MS,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('does not roll back a completed password change when physical session cleanup fails', async () => {
      sessionRepository.revokeAllSessions.mockRejectedValue(new Error('redis unavailable'));

      await expect(useCase.execute(input)).resolves.toEqual({ status: 'CHANGED' });
      expect(userRepository.save).toHaveBeenCalledTimes(1);
    });

    it('does not roll back a completed password change when immediate projection synchronization fails', async () => {
      synchronizer.synchronize.mockRejectedValue(new Error('redis unavailable'));

      await expect(useCase.execute(input)).resolves.toEqual({
        status: 'CHANGED',
      });
      expect(userRepository.save).toHaveBeenCalledTimes(1);
      expect(sessionRepository.revokeAllSessions).toHaveBeenCalledWith(userId);
    });

    it('sanitizes audit and outbox context without exposing passwords or the session JTI', async () => {
      const secretCurrentPassword = 'current-password-secret';
      const secretNewPassword = 'new-password-secret';

      await useCase.execute({
        ...input,
        currentPassword: secretCurrentPassword,
        newPassword: secretNewPassword,
        userAgent: 'u'.repeat(600),
        metadata: {
          ...input.metadata,
          browser: 'b'.repeat(300),
          unexpected: 'must not persist',
        } as unknown as typeof input.metadata,
      });

      const savedEvent = eventRepository.save.mock.calls[0][0];
      const outboxPayload = JSON.stringify(outboxWriteService.storeEvents.mock.calls[0][0]);

      expect(savedEvent.userAgent).toHaveLength(512);
      expect(savedEvent.metadata).not.toHaveProperty('unexpected');
      expect(savedEvent.metadata.browser).toHaveLength(256);
      expect(outboxPayload).not.toContain(secretCurrentPassword);
      expect(outboxPayload).not.toContain(secretNewPassword);
      expect(outboxPayload).not.toContain(sessionId);
      expect(outboxPayload).not.toContain('new-hash');
    });

    it('rebuilds the projection to release the barrier after a transactional error', async () => {
      userRepository.findByIdForUpdate.mockRejectedValue(new Error('database failure'));

      await expect(useCase.execute(input)).rejects.toThrow('database failure');
      expect(synchronizer.synchronize).toHaveBeenCalledWith(userId, now, expect.any(String));
    });
  });
});
