import { EmailJobQueue } from '@/modules/notifications/application/queues/email-job-queue.port';
import { EnqueueWelcomeEmailOnUserCreatedHandler } from '@/modules/notifications/application/handlers/enqueue-welcome-email-on-user-created.handler';
import { CreateWelcomeEmailMessageUseCase } from '@/modules/notifications/application/use-cases/create-welcome-email-message/create-welcome-email-message.use-case';
import {
  BrevoTemplateId,
  EmailMessageStatus,
  EmailMessageType,
  EmailProviderKey,
  EmailTemplateKey,
} from '@/modules/notifications/domain/constants/email-message.constants';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import { UserCreatedEvent } from '@/modules/users/domain/events/user-created.event';
import { Email } from '@/modules/users/domain/value-objects/email.value-object';
import { UserStatus } from '@/common/models/enums';

const makeEmailMessage = (): EmailMessage =>
  EmailMessage.reconstitute(
    {
      type: EmailMessageType.WELCOME,
      recipientEmail: 'daniel@example.com',
      recipientName: 'Daniel',
      provider: EmailProviderKey.BREVO,
      templateKey: EmailTemplateKey.WELCOME,
      providerTemplateId: BrevoTemplateId.WELCOME,
      templateParams: {},
      idempotencyKey: 'email:welcome:user:user-1',
      status: EmailMessageStatus.PENDING,
      providerMessageId: null,
      attemptsCount: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
      processingAt: null,
      sentAt: null,
      failedAt: null,
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    },
    'email-message-1',
  );

describe('EnqueueWelcomeEmailOnUserCreatedHandler', () => {
  let createWelcomeEmailMessageUseCase: jest.Mocked<CreateWelcomeEmailMessageUseCase>;
  let emailJobQueue: jest.Mocked<EmailJobQueue>;
  let execute: jest.MockedFunction<CreateWelcomeEmailMessageUseCase['execute']>;
  let enqueueEmailMessage: jest.MockedFunction<EmailJobQueue['enqueueEmailMessage']>;
  let handler: EnqueueWelcomeEmailOnUserCreatedHandler;

  beforeEach(() => {
    jest.clearAllMocks();

    execute = jest.fn();
    enqueueEmailMessage = jest.fn();
    createWelcomeEmailMessageUseCase = {
      execute,
    } as unknown as jest.Mocked<CreateWelcomeEmailMessageUseCase>;
    emailJobQueue = {
      enqueueEmailMessage,
    };
    handler = new EnqueueWelcomeEmailOnUserCreatedHandler(createWelcomeEmailMessageUseCase, emailJobQueue);
  });

  describe('handle', () => {
    it('creates the idempotent welcome email intent and enqueues it', async () => {
      const emailMessage = makeEmailMessage();
      execute.mockResolvedValue({
        emailMessage,
        created: true,
        shouldEnqueue: true,
      });

      await handler.handle(UserCreatedEvent.create('user-1', UserStatus.ACTIVE, Email.create('daniel@example.com')));

      expect(execute).toHaveBeenCalledWith({
        userId: 'user-1',
        email: 'daniel@example.com',
      });
      expect(enqueueEmailMessage).toHaveBeenCalledWith('email-message-1');
    });

    it('does not enqueue when the intent is terminal', async () => {
      execute.mockResolvedValue({
        emailMessage: makeEmailMessage(),
        created: false,
        shouldEnqueue: false,
      });

      await handler.handle(UserCreatedEvent.create('user-1', UserStatus.ACTIVE, Email.create('daniel@example.com')));

      expect(enqueueEmailMessage).not.toHaveBeenCalled();
    });
  });
});
