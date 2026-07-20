import { Email } from '@/common/domain/value-objects/email.value-object';
import { UserStatus } from '@/common/models/enums';
import type { CreateEmailVerificationChallengeUseCase } from '@/modules/auth/application/use-cases/create-email-verification-challenge/create-email-verification-challenge.use-case';
import type { EmailVerificationChallenge } from '@/modules/auth/domain/entities/email-verification-challenge.entity';
import type { EmailJobQueueProducer } from '@/modules/notifications/application/queues/email-job-queue-producer.port';
import type { CreateEmailVerificationMessageUseCase } from '@/modules/notifications/application/use-cases/create-email-verification-message/create-email-verification-message.use-case';
import type { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import { UserCreatedEvent } from '@/modules/users/domain/events/user-created.event';
import type { DataSource, EntityManager } from 'typeorm';
import { EnqueueEmailVerificationOnUserCreatedHandler } from './enqueue-email-verification-on-user-created.handler';

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
        challenge: { id: 'challenge-1' } as EmailVerificationChallenge,
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
    const handler = new EnqueueEmailVerificationOnUserCreatedHandler(
      createChallenge,
      createMessage,
      producer,
      dataSource,
    );

    await expect(
      handler.handle(
        UserCreatedEvent.create('user-1', UserStatus.PENDING_EMAIL_VERIFICATION, Email.create('daniel@example.com')),
      ),
    ).rejects.toThrow('redis unavailable');

    expect(callOrder).toEqual(['transaction-committed', 'queue-attempt']);
    expect(enqueueEmailMessage).toHaveBeenCalledWith('email-message-1');
  });
});
