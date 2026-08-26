/* eslint-disable @typescript-eslint/unbound-method */
import { UserStatus } from '@/common/models/enums';
import {
  EmailVerificationCooldownActiveError,
  EmailVerificationDailyLimitExceededError,
  EmailVerificationOperationPendingError,
  EmailVerificationStateUnavailableError,
} from '@/modules/auth/application/errors';
import type { IEmailVerificationResendStateStore } from '@/modules/auth/application/ports/email-verification-resend-state-store.interface';
import type { CreateEmailVerificationChallengeUseCase } from '@/modules/auth/application/use-cases/create-email-verification-challenge/create-email-verification-challenge.use-case';
import { ResendEmailVerificationUseCase } from '@/modules/auth/application/use-cases/resend-email-verification/resend-email-verification.use-case';
import {
  EmailVerificationChallengeOrigin,
  EmailVerificationResendMutationKind,
  EmailVerificationResendRestriction,
  EmailVerificationResendStatus,
} from '@/modules/auth/domain/constants/email-verification.constants';
import type { EmailVerificationChallenge } from '@/modules/auth/domain/entities/email-verification-challenge.entity';
import type { EmailJobQueueProducer } from '@/modules/notifications/application/queues/email-job-queue-producer.port';
import type { CreateEmailVerificationMessageUseCase } from '@/modules/notifications/application/use-cases/create-email-verification-message/create-email-verification-message.use-case';
import type { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import type { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import type { DataSource, EntityManager } from 'typeorm';

describe('ResendEmailVerificationUseCase', () => {
  const pendingUser = {
    id: 'user-1',
    status: UserStatus.PENDING_EMAIL_VERIFICATION,
    email: { value: 'daniel@example.com' },
  } as User;
  const challenge = {
    id: 'challenge-1',
    expiresAt: new Date('2026-01-01T10:15:00.000Z'),
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
  } as EmailVerificationChallenge;

  let callOrder: string[];
  let userRepository: jest.Mocked<IUserRepository>;
  let createChallenge: jest.Mocked<CreateEmailVerificationChallengeUseCase>;
  let createMessage: jest.Mocked<CreateEmailVerificationMessageUseCase>;
  let producer: jest.Mocked<EmailJobQueueProducer>;
  let resendStateStore: jest.Mocked<IEmailVerificationResendStateStore>;
  let transaction: jest.Mock;
  let useCase: ResendEmailVerificationUseCase;

  beforeEach(() => {
    callOrder = [];
    const manager = {} as EntityManager;
    transaction = jest.fn(async <T>(callback: (transactionManager: EntityManager) => Promise<T>): Promise<T> => {
      const result = await callback(manager);
      callOrder.push('transaction-committed');
      return result;
    });
    const dataSource = { transaction } as unknown as DataSource;
    userRepository = {
      findById: jest.fn().mockResolvedValue(pendingUser),
      findByIdForUpdate: jest.fn().mockResolvedValue(pendingUser),
    } as unknown as jest.Mocked<IUserRepository>;
    createChallenge = {
      execute: jest.fn().mockResolvedValue({ challenge, token: 'verification-token', created: true }),
    } as unknown as jest.Mocked<CreateEmailVerificationChallengeUseCase>;
    createMessage = {
      execute: jest.fn().mockResolvedValue({
        emailMessage: { id: 'email-message-1' } as EmailMessage,
        created: true,
        shouldEnqueue: true,
      }),
    } as unknown as jest.Mocked<CreateEmailVerificationMessageUseCase>;
    producer = {
      enqueueEmailMessage: jest.fn(() => {
        callOrder.push('queue-attempt');
        return Promise.resolve();
      }),
    } as unknown as jest.Mocked<EmailJobQueueProducer>;
    resendStateStore = {
      load: jest.fn(),
      beginMutation: jest.fn().mockResolvedValue({
        kind: EmailVerificationResendMutationKind.ACQUIRED,
        manualResendsUsed: 0,
      }),
      renewMutation: jest.fn().mockResolvedValue(undefined),
      completeLogicalSend: jest.fn(() => {
        callOrder.push('redis-completed');
        return Promise.resolve();
      }),
      abortMutation: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IEmailVerificationResendStateStore>;
    useCase = new ResendEmailVerificationUseCase(
      userRepository,
      createChallenge,
      createMessage,
      producer,
      resendStateStore,
      dataSource,
    );
    jest.clearAllMocks();
  });

  it('commits and completes the logical send before attempting the immediate enqueue', async () => {
    producer.enqueueEmailMessage.mockImplementation(() => {
      callOrder.push('queue-attempt');
      return Promise.reject(new Error('redis unavailable'));
    });

    await expect(useCase.execute({ userId: 'user-1' })).resolves.toEqual({
      status: EmailVerificationResendStatus.QUEUED,
    });

    expect(callOrder).toEqual(['transaction-committed', 'redis-completed', 'queue-attempt']);
    expect(createChallenge.execute).toHaveBeenCalledWith(
      expect.objectContaining({ origin: EmailVerificationChallengeOrigin.MANUAL_RESEND }),
    );
    expect(resendStateStore.renewMutation).toHaveBeenCalledTimes(3);
    const renewalToken = resendStateStore.renewMutation.mock.calls[0]?.[1];
    expect(resendStateStore.renewMutation).toHaveBeenNthCalledWith(1, 'user-1', renewalToken);
    expect(resendStateStore.renewMutation).toHaveBeenNthCalledWith(2, 'user-1', renewalToken);
    expect(resendStateStore.renewMutation).toHaveBeenNthCalledWith(3, 'user-1', renewalToken);
    expect(createMessage.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        challengeId: 'challenge-1',
        deliverBefore: new Date('2026-01-01T10:10:00.000Z'),
      }),
    );
    expect(producer.enqueueEmailMessage).toHaveBeenCalledWith('email-message-1');
  });

  it('returns already verified before consulting Redis', async () => {
    userRepository.findById.mockResolvedValue({ id: 'user-1', status: UserStatus.ACTIVE } as User);

    await expect(useCase.execute({ userId: 'user-1' })).resolves.toEqual({
      status: EmailVerificationResendStatus.ALREADY_VERIFIED,
    });

    expect(resendStateStore.beginMutation).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('fails closed without opening a transaction when Redis is unavailable', async () => {
    resendStateStore.beginMutation.mockRejectedValue(new Error('redis unavailable'));

    await expect(useCase.execute({ userId: 'user-1' })).rejects.toBeInstanceOf(EmailVerificationStateUnavailableError);
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([
    [EmailVerificationResendRestriction.COOLDOWN, EmailVerificationCooldownActiveError],
    [EmailVerificationResendRestriction.DAILY_LIMIT, EmailVerificationDailyLimitExceededError],
    [EmailVerificationResendRestriction.OPERATION_PENDING, EmailVerificationOperationPendingError],
  ] as const)('maps %s to its retry-aware application error', async (blockedBy, ErrorType) => {
    resendStateStore.beginMutation.mockResolvedValue({
      kind: EmailVerificationResendMutationKind.BLOCKED,
      blockedBy,
      retryAfterSeconds: 73,
      manualResendsUsed: 2,
    });

    await expect(useCase.execute({ userId: 'user-1' })).rejects.toBeInstanceOf(ErrorType);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('aborts the owned barrier when the SQL transaction fails', async () => {
    createChallenge.execute.mockRejectedValue(new Error('postgres unavailable'));

    await expect(useCase.execute({ userId: 'user-1' })).rejects.toThrow('postgres unavailable');

    expect(resendStateStore.abortMutation).toHaveBeenCalledWith('user-1', expect.any(String));
    expect(resendStateStore.completeLogicalSend).not.toHaveBeenCalled();
    expect(producer.enqueueEmailMessage).not.toHaveBeenCalled();
  });

  it('rolls back before writing when the barrier expired while waiting for the user lock', async () => {
    resendStateStore.renewMutation.mockRejectedValue(new Error('mutation ownership lost'));

    await expect(useCase.execute({ userId: 'user-1' })).rejects.toBeInstanceOf(EmailVerificationStateUnavailableError);

    expect(resendStateStore.renewMutation).toHaveBeenCalledTimes(1);
    expect(createChallenge.execute).not.toHaveBeenCalled();
    expect(createMessage.execute).not.toHaveBeenCalled();
    expect(resendStateStore.abortMutation).toHaveBeenCalledWith('user-1', expect.any(String));
  });

  it('rolls back prior writes when ownership is lost during the transaction', async () => {
    resendStateStore.renewMutation
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('mutation ownership lost'));

    await expect(useCase.execute({ userId: 'user-1' })).rejects.toBeInstanceOf(EmailVerificationStateUnavailableError);

    expect(createChallenge.execute).toHaveBeenCalledTimes(1);
    expect(createMessage.execute).not.toHaveBeenCalled();
    expect(resendStateStore.completeLogicalSend).not.toHaveBeenCalled();
    expect(resendStateStore.abortMutation).toHaveBeenCalledWith('user-1', expect.any(String));
  });

  it('rechecks the user under lock and aborts when verification completed concurrently', async () => {
    userRepository.findByIdForUpdate.mockResolvedValue({ id: 'user-1', status: UserStatus.ACTIVE } as User);

    await expect(useCase.execute({ userId: 'user-1' })).resolves.toEqual({
      status: EmailVerificationResendStatus.ALREADY_VERIFIED,
    });

    expect(resendStateStore.abortMutation).toHaveBeenCalledWith('user-1', expect.any(String));
    expect(createChallenge.execute).not.toHaveBeenCalled();
    expect(resendStateStore.completeLogicalSend).not.toHaveBeenCalled();
  });

  it('keeps accepted semantics after commit when Redis completion fails', async () => {
    resendStateStore.completeLogicalSend.mockRejectedValue(new Error('redis unavailable'));

    await expect(useCase.execute({ userId: 'user-1' })).resolves.toEqual({
      status: EmailVerificationResendStatus.QUEUED,
    });

    expect(producer.enqueueEmailMessage).toHaveBeenCalledWith('email-message-1');
    expect(resendStateStore.abortMutation).not.toHaveBeenCalled();
  });
});
