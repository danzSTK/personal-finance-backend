import type { DataSource, EntityManager } from 'typeorm';
import { UserStatus } from '@/common/models/enums';
import type { User } from '@/modules/users/domain/entities/user.entity';
import type { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import type { EmailVerificationChallenge } from '@/modules/auth/domain/entities/email-verification-challenge.entity';
import type { CreateEmailVerificationChallengeUseCase } from '@/modules/auth/application/use-cases/create-email-verification-challenge/create-email-verification-challenge.use-case';
import type { CreateEmailVerificationMessageUseCase } from '@/modules/notifications/application/use-cases/create-email-verification-message/create-email-verification-message.use-case';
import type { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import type { EmailJobQueueProducer } from '@/modules/notifications/application/queues/email-job-queue-producer.port';
import { ResendEmailVerificationUseCase } from './resend-email-verification.use-case';

describe('ResendEmailVerificationUseCase', () => {
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
    const userRepository = {
      findByIdForUpdate: jest.fn().mockResolvedValue({
        id: 'user-1',
        status: UserStatus.PENDING_EMAIL_VERIFICATION,
        email: { value: 'daniel@example.com' },
      } as User),
    } as unknown as IUserRepository;
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
    const useCase = new ResendEmailVerificationUseCase(
      userRepository,
      createChallenge,
      createMessage,
      producer,
      dataSource,
    );

    await expect(useCase.execute({ userId: 'user-1' })).rejects.toThrow('redis unavailable');

    expect(callOrder).toEqual(['transaction-committed', 'queue-attempt']);
    expect(enqueueEmailMessage).toHaveBeenCalledWith('email-message-1');
  });
});
