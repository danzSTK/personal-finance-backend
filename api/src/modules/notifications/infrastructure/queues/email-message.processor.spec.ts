import { SendEmailMessageUseCase } from '@/modules/notifications/application/use-cases/send-email-message/send-email-message.use-case';
import { EmailMessageProcessor } from '@/modules/notifications/infrastructure/queues/email-message.processor';
import {
  EmailJobNames,
  SendEmailMessageJobPayload,
} from '@/modules/notifications/infrastructure/queues/email-job.constants';
import { Job } from 'bullmq';

describe('EmailMessageProcessor', () => {
  let sendEmailMessageUseCase: jest.Mocked<SendEmailMessageUseCase>;
  let execute: jest.MockedFunction<SendEmailMessageUseCase['execute']>;
  let processor: EmailMessageProcessor;

  beforeEach(() => {
    jest.clearAllMocks();

    execute = jest.fn();
    sendEmailMessageUseCase = {
      execute,
    } as unknown as jest.Mocked<SendEmailMessageUseCase>;
    processor = new EmailMessageProcessor(sendEmailMessageUseCase);
  });

  describe('process', () => {
    it('executes the send use case with only emailMessageId from the job payload', async () => {
      await processor.process({
        name: EmailJobNames.SEND_EMAIL_MESSAGE,
        data: { emailMessageId: 'email-message-1' },
      } as Job<SendEmailMessageJobPayload>);

      expect(execute).toHaveBeenCalledWith({ emailMessageId: 'email-message-1' });
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
