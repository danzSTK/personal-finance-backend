import { BullmqEmailJobQueue } from '@/modules/notifications/infrastructure/queues/bullmq-email-job-queue';
import { EmailJobNames } from '@/modules/notifications/infrastructure/queues/email-job.constants';
import { Queue } from 'bullmq';

describe('BullmqEmailJobQueue', () => {
  let queue: jest.Mocked<Queue>;
  let addJob: jest.MockedFunction<Queue['add']>;
  let emailJobQueue: BullmqEmailJobQueue;

  beforeEach(() => {
    jest.clearAllMocks();

    addJob = jest.fn();
    queue = {
      add: addJob,
    } as unknown as jest.Mocked<Queue>;
    emailJobQueue = new BullmqEmailJobQueue(queue);
  });

  describe('enqueueEmailMessage', () => {
    it('adds a sanitized deterministic BullMQ job id', async () => {
      await emailJobQueue.enqueueEmailMessage('email-message-uuid:with-colon');

      expect(addJob).toHaveBeenCalledWith(
        EmailJobNames.SEND_EMAIL_MESSAGE,
        { emailMessageId: 'email-message-uuid:with-colon' },
        { jobId: 'email-message-email-message-uuid-with-colon' },
      );
    });
  });
});
