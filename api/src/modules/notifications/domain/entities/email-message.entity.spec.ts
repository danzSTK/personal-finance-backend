import {
  BrevoTemplateId,
  EmailMessageStatus,
  EmailMessageType,
  EmailProviderKey,
  EmailTemplateKey,
} from '@/modules/notifications/domain/constants/email-message.constants';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import { InvalidEmailMessageError } from '@/modules/notifications/domain/errors';

const makeEmailMessage = (): EmailMessage =>
  EmailMessage.create(
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
      providerMessageId: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      processingAt: null,
      sentAt: null,
      failedAt: null,
    },
    'email-message-1',
  );

describe('EmailMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a pending email message intent', () => {
      const emailMessage = makeEmailMessage();

      expect(emailMessage.status).toBe(EmailMessageStatus.PENDING);
      expect(emailMessage.attemptsCount).toBe(0);
      expect(emailMessage.canBeEnqueued).toBe(true);
      expect(emailMessage.isTerminal).toBe(false);
    });

    it('rejects invalid recipient email', () => {
      expect(() =>
        EmailMessage.create(
          {
            type: EmailMessageType.WELCOME,
            recipientEmail: 'invalid-email',
            recipientName: null,
            provider: EmailProviderKey.BREVO,
            templateKey: EmailTemplateKey.WELCOME,
            providerTemplateId: BrevoTemplateId.WELCOME,
            templateParams: {},
            idempotencyKey: 'email:welcome:user:user-1',
            providerMessageId: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            processingAt: null,
            sentAt: null,
            failedAt: null,
          },
          'email-message-1',
        ),
      ).toThrow(InvalidEmailMessageError);
    });
  });

  describe('state transitions', () => {
    it('marks a message as processing and sent', () => {
      const emailMessage = makeEmailMessage();
      const processingAt = new Date('2026-01-01T10:00:00.000Z');
      const sentAt = new Date('2026-01-01T10:01:00.000Z');

      emailMessage.markProcessing(processingAt);
      emailMessage.markSent('brevo-message-1', sentAt);

      expect(emailMessage.status).toBe(EmailMessageStatus.SENT);
      expect(emailMessage.providerMessageId).toBe('brevo-message-1');
      expect(emailMessage.sentAt).toBe(sentAt);
      expect(emailMessage.processingAt).toBeNull();
      expect(emailMessage.isTerminal).toBe(true);
    });

    it('marks retryable failure and increments attempts', () => {
      const emailMessage = makeEmailMessage();
      const failedAt = new Date('2026-01-01T10:02:00.000Z');

      emailMessage.markProcessing();
      emailMessage.markFailed('MAIL_PROVIDER_TIMEOUT', 'Provider timeout.', true, failedAt);

      expect(emailMessage.status).toBe(EmailMessageStatus.FAILED_RETRYABLE);
      expect(emailMessage.attemptsCount).toBe(1);
      expect(emailMessage.lastErrorCode).toBe('MAIL_PROVIDER_TIMEOUT');
      expect(emailMessage.failedAt).toBe(failedAt);
      expect(emailMessage.canBeEnqueued).toBe(true);
    });

    it('does not allow canceling a sent message', () => {
      const emailMessage = makeEmailMessage();
      emailMessage.markProcessing();
      emailMessage.markSent('brevo-message-1');

      expect(() => emailMessage.cancel()).toThrow(InvalidEmailMessageError);
    });
  });
});
