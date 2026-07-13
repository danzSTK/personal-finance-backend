import { WorkerConfig } from '@/config/worker.config';
import { EmailJobQueueProducer } from '@/modules/notifications/application/queues/email-job-queue-producer.port';
import { IEmailMessageRepository } from '@/modules/notifications/domain/repositories/email-message.repository.interface';
import { EmailMessageEnqueueReconciler } from './email-message-enqueue-reconciler.service';

describe('EmailMessageEnqueueReconciler', () => {
  const config = {
    emailReconciliation: {
      intervalMs: 30_000,
      batchSize: 100,
      staleAfterMs: 30_000,
    },
  } as WorkerConfig;

  let findReenqueuableBefore: jest.MockedFunction<IEmailMessageRepository['findReenqueuableBefore']>;
  let enqueueEmailMessage: jest.MockedFunction<EmailJobQueueProducer['enqueueEmailMessage']>;
  let reconciler: EmailMessageEnqueueReconciler;

  beforeEach(() => {
    jest.clearAllMocks();
    findReenqueuableBefore = jest.fn();
    enqueueEmailMessage = jest.fn();
    reconciler = new EmailMessageEnqueueReconciler(
      { findReenqueuableBefore } as unknown as IEmailMessageRepository,
      { enqueueEmailMessage } as EmailJobQueueProducer,
      config,
    );
  });

  it('reenqueues every stale retryable message by persisted id', async () => {
    findReenqueuableBefore.mockResolvedValue([{ id: 'email-1' }, { id: 'email-2' }]);

    await reconciler.reconcile();

    expect(findReenqueuableBefore).toHaveBeenCalledWith(expect.any(Date), 100);
    expect(enqueueEmailMessage).toHaveBeenNthCalledWith(1, 'email-1');
    expect(enqueueEmailMessage).toHaveBeenNthCalledWith(2, 'email-2');
  });

  it('continues reconciling the batch when one enqueue fails', async () => {
    findReenqueuableBefore.mockResolvedValue([{ id: 'email-1' }, { id: 'email-2' }]);
    enqueueEmailMessage.mockRejectedValueOnce(new Error('redis unavailable'));

    await reconciler.reconcile();

    expect(enqueueEmailMessage).toHaveBeenCalledTimes(2);
  });
});
