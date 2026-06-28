import mailConfig from './mail.config';

describe('mailConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('defaults', () => {
    it('uses noop provider with mail disabled by default', () => {
      delete process.env.MAIL_ENABLED;
      delete process.env.MAIL_PROVIDER;
      delete process.env.MAIL_DEFAULT_FROM_EMAIL;
      delete process.env.MAIL_DEFAULT_FROM_NAME;
      delete process.env.BREVO_API_KEY;
      delete process.env.BREVO_API_BASE_URL;
      delete process.env.BREVO_API_TIMEOUT_MS;
      delete process.env.BREVO_API_MAX_RETRIES;

      const config = mailConfig();

      expect(config).toEqual({
        enabled: false,
        provider: 'noop',
        defaultSender: {
          email: undefined,
          name: undefined,
        },
        brevo: {
          apiKey: undefined,
          baseUrl: 'https://api.brevo.com/v3',
          timeoutMs: 10000,
          maxRetries: 2,
        },
      });
    });
  });

  describe('environment values', () => {
    it('reads Brevo provider settings from environment variables', () => {
      process.env.MAIL_ENABLED = 'true';
      process.env.MAIL_PROVIDER = 'brevo';
      process.env.MAIL_DEFAULT_FROM_EMAIL = 'no-reply@example.com';
      process.env.MAIL_DEFAULT_FROM_NAME = 'Finance App';
      process.env.BREVO_API_KEY = 'brevo-key';
      process.env.BREVO_API_BASE_URL = 'https://api.example.com';
      process.env.BREVO_API_TIMEOUT_MS = '5000';
      process.env.BREVO_API_MAX_RETRIES = '1';

      const config = mailConfig();

      expect(config).toEqual({
        enabled: true,
        provider: 'brevo',
        defaultSender: {
          email: 'no-reply@example.com',
          name: 'Finance App',
        },
        brevo: {
          apiKey: 'brevo-key',
          baseUrl: 'https://api.example.com',
          timeoutMs: 5000,
          maxRetries: 1,
        },
      });
    });

    it('falls back to noop for unsupported provider values after Joi validation boundary', () => {
      process.env.MAIL_PROVIDER = 'unknown';

      const config = mailConfig();

      expect(config.provider).toBe('noop');
    });
  });
});
