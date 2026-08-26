/* eslint-disable @typescript-eslint/unbound-method */
import { Email } from '@/common/domain/value-objects/email.value-object';
import { UserStatus } from '@/common/models/enums';
import type { CreateEmailVerificationChallengeUseCase } from '@/modules/auth/application/use-cases/create-email-verification-challenge/create-email-verification-challenge.use-case';
import type { EmailVerificationChallenge } from '@/modules/auth/domain/entities/email-verification-challenge.entity';
import { EmailVerificationChallengeOrigin } from '@/modules/auth/domain/constants/email-verification.constants';
import type { EmailJobQueueProducer } from '@/modules/notifications/application/queues/email-job-queue-producer.port';
import type { CreateEmailVerificationMessageUseCase } from '@/modules/notifications/application/use-cases/create-email-verification-message/create-email-verification-message.use-case';
import type { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import { UserCreatedEvent } from '@/modules/users/domain/events/user-created.event';
import type { DataSource, EntityManager } from 'typeorm';
import { EnqueueEmailVerificationOnUserCreatedHandler } from './enqueue-email-verification-on-user-created.handler';
import type { IEmailVerificationResendStateStore } from '@/modules/auth/application/ports/email-verification-resend-state-store.interface';

describe('EnqueueEmailVerificationOnUserCreatedHandler', () => {
  it('commits the email intent before attempting enqueue so reconciliation can recover a queue failure', async () => {
    const callOrder: string[] = [];
    const manager = {} as EntityManager;
    const transaction = jest.fn(async <T>(callback: (transactionManager: EntityManager) => Promise<T>): Promise<T> => {
      const result = await callback(manager);
      callOrder.push('transaction-committed');
      return result;
    });
    const dataSource = {
      transaction,
    } as unknown as DataSource;
    const createChallenge = {
      execute: jest.fn().mockResolvedValue({
        challenge: {
          id: 'challenge-1',
          expiresAt: new Date('2026-01-01T10:15:00.000Z'),
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        } as EmailVerificationChallenge,
        token: 'verification-token',
        created: true,
      }),
    } as unknown as CreateEmailVerificationChallengeUseCase;
    const createMessage = {
      execute: jest.fn().mockResolvedValue({
        emailMessage: { id: 'email-message-1' } as EmailMessage,
        created: true,
        shouldEnqueue: true,
      }),
    } as unknown as CreateEmailVerificationMessageUseCase;
    const enqueueEmailMessage = jest.fn(() => {
      callOrder.push('queue-attempt');
      return Promise.reject(new Error('redis unavailable'));
    });
    const producer = { enqueueEmailMessage } as EmailJobQueueProducer;
    const resendStateStore = {
      load: jest.fn(),
      beginMutation: jest.fn(),
      completeLogicalSend: jest.fn(() => {
        callOrder.push('redis-completed');
        return Promise.resolve();
      }),
      abortMutation: jest.fn(),
    } as unknown as IEmailVerificationResendStateStore;
    const handler = new EnqueueEmailVerificationOnUserCreatedHandler(
      createChallenge,
      createMessage,
      producer,
      resendStateStore,
      dataSource,
    );

    await expect(
      handler.handle(
        UserCreatedEvent.create('user-1', UserStatus.PENDING_EMAIL_VERIFICATION, Email.create('daniel@example.com')),
      ),
    ).rejects.toThrow('redis unavailable');

    expect(callOrder).toEqual(['transaction-committed', 'redis-completed', 'queue-attempt']);
    expect(createChallenge.execute).toHaveBeenCalledWith(
      expect.objectContaining({ origin: EmailVerificationChallengeOrigin.AUTOMATIC }),
    );
    expect(createMessage.execute).toHaveBeenCalledWith(
      expect.objectContaining({ deliverBefore: new Date('2026-01-01T10:10:00.000Z') }),
    );
    expect(resendStateStore.completeLogicalSend).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: EmailVerificationChallengeOrigin.AUTOMATIC,
        challengeId: 'challenge-1',
      }),
    );
    expect(enqueueEmailMessage).toHaveBeenCalledWith('email-message-1');
  });
});
