import { MailError } from '@/shared/mail/errors/mail-error';
import { MailService } from '@/shared/mail/mail.service';
import {
  BrevoTemplateId,
  EmailMessageStatus,
  EmailMessageType,
  EmailProviderKey,
  EmailTemplateKey,
} from '@/modules/notifications/domain/constants/email-message.constants';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import { IEmailMessageRepository } from '@/modules/notifications/domain/repositories/email-message.repository.interface';
import { SendEmailMessageUseCase } from '@/modules/notifications/application/use-cases/send-email-message/send-email-message.use-case';
import { DataSource, EntityManager } from 'typeorm';

const makeEmailMessage = (): EmailMessage =>
  EmailMessage.reconstitute(
    {
      type: EmailMessageType.WELCOME,
      recipientEmail: 'daniel@example.com',
      recipientName: 'Daniel',
      provider: EmailProviderKey.BREVO,
      templateKey: EmailTemplateKey.WELCOME,
      providerTemplateId: BrevoTemplateId.WELCOME,
      templateParams: {
        first_name: 'Daniel',
        dashboard_url: 'https://app.danfy.com/dashboard',
        support_url: 'https://danfy.com/suporte',
        support_url_label: 'Central de ajuda',
        preferences_url: 'https://app.danfy.com/settings/email-preferences',
      },
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

describe('SendEmailMessageUseCase', () => {
  let emailMessageRepository: jest.Mocked<IEmailMessageRepository>;
  let mailService: jest.Mocked<MailService>;
  let dataSource: DataSource;
  let manager: EntityManager;
  let findByIdForUpdate: jest.MockedFunction<IEmailMessageRepository['findByIdForUpdate']>;
  let saveEmailMessage: jest.MockedFunction<IEmailMessageRepository['save']>;
  let sendMail: jest.MockedFunction<MailService['send']>;
  let useCase: SendEmailMessageUseCase;

  beforeEach(() => {
    jest.clearAllMocks();

    manager = {} as EntityManager;
    findByIdForUpdate = jest.fn();
    saveEmailMessage = jest.fn();
    sendMail = jest.fn();
    const transaction = jest.fn(<T>(callback: (entityManager: EntityManager) => Promise<T>): Promise<T> => {
      return callback(manager);
    });
    emailMessageRepository = {
      findById: jest.fn(),
      findByIdForUpdate,
      findByIdempotencyKey: jest.fn(),
      save: saveEmailMessage,
    };
    mailService = {
      send: sendMail,
    } as unknown as jest.Mocked<MailService>;
    dataSource = {
      transaction,
    } as unknown as DataSource;
    useCase = new SendEmailMessageUseCase(emailMessageRepository, mailService, dataSource);
  });

  describe('execute', () => {
    it('sends the email through MailService and marks the message as sent', async () => {
      const emailMessage = makeEmailMessage();
      findByIdForUpdate.mockResolvedValue(emailMessage);
      saveEmailMessage.mockImplementation(message => Promise.resolve(message));
      sendMail.mockResolvedValue({ provider: 'brevo', messageId: 'brevo-message-1', accepted: 1 });

      const result = await useCase.execute({ emailMessageId: 'email-message-1' });

      expect(sendMail).toHaveBeenCalledWith({
        to: [{ email: 'daniel@example.com', name: 'Daniel' }],
        templateId: 2,
        params: emailMessage.templateParams,
        tags: ['welcome-email', 'WELCOME'],
        metadata: {
          'X-Danfy-Email-Message-Id': 'email-message-1',
        },
      });
      expect(result).toEqual({ status: EmailMessageStatus.SENT, sent: true });
      expect(emailMessage.status).toBe(EmailMessageStatus.SENT);
      expect(emailMessage.providerMessageId).toBe('brevo-message-1');
    });

    it('marks retryable failures and rethrows so BullMQ can retry', async () => {
      const emailMessage = makeEmailMessage();
      const error = MailError.providerTimeout('timeout');
      findByIdForUpdate.mockResolvedValue(emailMessage);
      saveEmailMessage.mockImplementation(message => Promise.resolve(message));
      sendMail.mockRejectedValue(error);

      await expect(useCase.execute({ emailMessageId: 'email-message-1' })).rejects.toBe(error);

      expect(emailMessage.status).toBe(EmailMessageStatus.FAILED_RETRYABLE);
      expect(emailMessage.attemptsCount).toBe(1);
      expect(emailMessage.lastErrorCode).toBe('MAIL_PROVIDER_TIMEOUT');
    });

    it('marks permanent failures without throwing retryable errors', async () => {
      const emailMessage = makeEmailMessage();
      findByIdForUpdate.mockResolvedValue(emailMessage);
      saveEmailMessage.mockImplementation(message => Promise.resolve(message));
      sendMail.mockRejectedValue(MailError.invalidPayload('invalid template payload'));

      const result = await useCase.execute({ emailMessageId: 'email-message-1' });

      expect(result).toEqual({ status: EmailMessageStatus.FAILED_PERMANENT, sent: false });
      expect(emailMessage.status).toBe(EmailMessageStatus.FAILED_PERMANENT);
      expect(emailMessage.attemptsCount).toBe(1);
      expect(emailMessage.lastErrorCode).toBe('MAIL_INVALID_PAYLOAD');
    });

    it('does not send terminal messages again', async () => {
      const emailMessage = makeEmailMessage();
      emailMessage.markProcessing();
      emailMessage.markSent('brevo-message-1');
      findByIdForUpdate.mockResolvedValue(emailMessage);

      const result = await useCase.execute({ emailMessageId: 'email-message-1' });

      expect(result).toEqual({ status: EmailMessageStatus.SENT, sent: true });
      expect(sendMail).not.toHaveBeenCalled();
    });
  });
});
