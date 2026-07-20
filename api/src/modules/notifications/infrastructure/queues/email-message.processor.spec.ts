import { SendEmailMessageUseCase } from '@/modules/notifications/application/use-cases/send-email-message/send-email-message.use-case';
import { EmailMessageStatus } from '@/modules/notifications/domain/constants/email-message.constants';
import { EmailMessageProcessor } from '@/modules/notifications/infrastructure/queues/email-message.processor';
import {
  EmailJobNames,
  SendEmailMessageJobPayload,
} from '@/modules/notifications/infrastructure/queues/email-job.constants';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueConfig } from '@/config/queue.config';

describe('EmailMessageProcessor', () => {
  let sendEmailMessageUseCase: jest.Mocked<SendEmailMessageUseCase>;
  let execute: jest.MockedFunction<SendEmailMessageUseCase['execute']>;
  let warnLogger: jest.SpyInstance;
  let processor: EmailMessageProcessor;

  beforeEach(() => {
    jest.clearAllMocks();

    warnLogger = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    execute = jest.fn();
    sendEmailMessageUseCase = {
      execute,
    } as unknown as jest.Mocked<SendEmailMessageUseCase>;
    const queueConfig = {
      workers: { defaultConcurrency: 2 },
    } as QueueConfig;
    processor = new EmailMessageProcessor(sendEmailMessageUseCase, queueConfig);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('process', () => {
    it('executes the send use case with only emailMessageId from the job payload', async () => {
      execute.mockResolvedValue({ status: EmailMessageStatus.SENT, sent: true });

      await processor.process({
        id: 'job-1',
        name: EmailJobNames.SEND_EMAIL_MESSAGE,
        data: { emailMessageId: 'email-message-1' },
      } as Job<SendEmailMessageJobPayload>);

      expect(execute).toHaveBeenCalledWith({ emailMessageId: 'email-message-1' });
      expect(warnLogger).not.toHaveBeenCalled();
    });

    it('logs when the job completes without sending the email', async () => {
      execute.mockResolvedValue({ status: EmailMessageStatus.FAILED_PERMANENT, sent: false });

      await processor.process({
        id: 'job-1',
        name: EmailJobNames.SEND_EMAIL_MESSAGE,
        data: { emailMessageId: 'email-message-1' },
      } as Job<SendEmailMessageJobPayload>);

      expect(warnLogger).toHaveBeenCalledWith(
        'Email message job completed without sending. jobId=job-1 emailMessageId=email-message-1 status=FAILED_PERMANENT',
      );
    });

    it('rejects unsupported job names', async () => {
      await expect(
        processor.process({
          name: 'unknown-job',
          data: { emailMessageId: 'email-message-1' },
        } as Job<SendEmailMessageJobPayload>),
      ).rejects.toThrow('Unsupported notifications email job');
    });
  });
});
