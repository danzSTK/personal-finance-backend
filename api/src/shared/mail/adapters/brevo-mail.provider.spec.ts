import { Brevo } from '@getbrevo/brevo';
import { MailErrorCode } from '../errors';
import { BrevoClientPort } from '../providers/brevo-client.provider';
import { BrevoMailProvider } from './brevo-mail.provider';
import { MailConfig } from '@/config/mail.config';

describe('BrevoMailProvider', () => {
  let sendTransacEmail: jest.MockedFunction<
    (request?: Brevo.SendTransacEmailRequest) => Promise<Brevo.SendTransacEmailResponse>
  >;
  let provider: BrevoMailProvider;
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
      templateIds: {
        'welcome-email:v1': 123,
        'email-verification:v1': 456,
      },
    },
  };

  beforeEach(() => {
    sendTransacEmail = jest.fn();
    const client: BrevoClientPort = {
      transactionalEmails: {
        sendTransacEmail,
      } as unknown as BrevoClientPort['transactionalEmails'],
    };

    provider = new BrevoMailProvider(client, config);
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('maps internal message to Brevo SDK payload', async () => {
      sendTransacEmail.mockResolvedValue({ messageId: 'message-id' });

      const result = await provider.send({
        to: [{ email: 'user@example.com', name: 'User' }],
        from: { email: 'no-reply@example.com', name: 'Finance App' },
        replyTo: { email: 'support@example.com' },
        subject: 'Hello',
        html: '<p>Hello</p>',
        text: 'Hello',
        params: { firstName: 'Ada' },
        tags: ['welcome'],
        metadata: { 'X-Trace-Id': 'trace-id' },
      });

      expect(result).toEqual({
        provider: 'brevo',
        messageId: 'message-id',
        messageIds: undefined,
        accepted: 1,
      });
      expect(sendTransacEmail).toHaveBeenCalledWith({
        to: [{ email: 'user@example.com', name: 'User' }],
        sender: { email: 'no-reply@example.com', name: 'Finance App' },
        replyTo: { email: 'support@example.com', name: undefined },
        subject: 'Hello',
        htmlContent: '<p>Hello</p>',
        textContent: 'Hello',
        templateId: undefined,
        params: { firstName: 'Ada' },
        tags: ['welcome'],
        headers: { 'X-Trace-Id': 'trace-id' },
      });
    });

    it('prioritizes template payload over html and text content', async () => {
      sendTransacEmail.mockResolvedValue({ messageIds: ['message-id'] });

      await provider.send({
        to: [{ email: 'user@example.com' }],
        from: { email: 'no-reply@example.com' },
        template: { key: 'welcome-email', version: 1 },
        html: '<p>Ignored</p>',
        text: 'Ignored',
      });

      expect(sendTransacEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 123,
          htmlContent: undefined,
          textContent: undefined,
        }),
      );
    });

    it('rejects an unmapped template without calling Brevo', async () => {
      await expect(
        provider.send({
          to: [{ email: 'user@example.com' }],
          from: { email: 'no-reply@example.com' },
          template: { key: 'unknown-template', version: 1 },
        }),
      ).rejects.toMatchObject({
        code: MailErrorCode.TEMPLATE_MAPPING_MISSING,
        retryable: false,
      });

      expect(sendTransacEmail).not.toHaveBeenCalled();
    });

    it('maps SDK failures to sanitized mail errors', async () => {
      sendTransacEmail.mockRejectedValue(new Error('api-key leaked in raw error'));

      await expect(
        provider.send({
          to: [{ email: 'user@example.com' }],
          from: { email: 'no-reply@example.com' },
          subject: 'Hello',
          text: 'Hello',
        }),
      ).rejects.toMatchObject({
        code: MailErrorCode.PROVIDER_UNKNOWN,
        message: 'Mail provider failed unexpectedly.',
      });
    });
  });
});
