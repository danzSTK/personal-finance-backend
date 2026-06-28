import { MailConfig } from '@/config/mail.config';
import { MailError, MailErrorCode } from '@/shared/mail/errors';
import { MailProvider } from '@/shared/mail/interfaces/mail-provider.interface';
import { SendMailInput, SendMailResult } from '@/shared/mail/interfaces/mail-message.interface';
import { MailService } from './mail.service';

class FakeMailProvider extends MailProvider {
  send = jest.fn<Promise<SendMailResult>, [SendMailInput]>();
}

describe('MailService', () => {
  let provider: FakeMailProvider;
  let service: MailService;

  const config: MailConfig = {
    enabled: true,
    provider: 'brevo',
    defaultSender: {
      email: 'no-reply@example.com',
      name: 'Finance App',
    },
    brevo: {
      apiKey: 'brevo-key',
      baseUrl: 'https://api.brevo.com/v3',
      timeoutMs: 10000,
      maxRetries: 2,
    },
  };

  beforeEach(() => {
    provider = new FakeMailProvider();
    provider.send.mockResolvedValue({ provider: 'fake', accepted: 1, messageId: 'message-id' });
    service = new MailService(provider, config);
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('applies default sender and delegates to provider', async () => {
      const result = await service.send({
        to: [{ email: 'user@example.com' }],
        subject: 'Hello',
        html: '<p>Hello</p>',
      });

      expect(result).toEqual({ provider: 'fake', accepted: 1, messageId: 'message-id' });
      expect(provider.send).toHaveBeenCalledWith({
        to: [{ email: 'user@example.com' }],
        subject: 'Hello',
        html: '<p>Hello</p>',
        from: {
          email: 'no-reply@example.com',
          name: 'Finance App',
        },
      });
    });

    it('allows template emails without subject or body', async () => {
      await service.send({
        to: [{ email: 'user@example.com' }],
        templateId: 123,
        params: { firstName: 'Ada' },
      });

      expect(provider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 123,
          params: { firstName: 'Ada' },
        }),
      );
    });

    it('rejects messages without recipients', async () => {
      await expect(
        service.send({
          to: [],
          subject: 'Hello',
          html: '<p>Hello</p>',
        }),
      ).rejects.toMatchObject<Partial<MailError>>({
        code: MailErrorCode.INVALID_PAYLOAD,
        retryable: false,
      });
      expect(provider.send).not.toHaveBeenCalled();
    });

    it('rejects messages without content when no template is provided', async () => {
      await expect(
        service.send({
          to: [{ email: 'user@example.com' }],
          subject: 'Hello',
        }),
      ).rejects.toMatchObject<Partial<MailError>>({
        code: MailErrorCode.INVALID_PAYLOAD,
      });
      expect(provider.send).not.toHaveBeenCalled();
    });
  });
});
