import { PinoLogLevels } from '@/shared/observability/constants/observability.constants';
import observabilityConfig from './observability.config';

describe('observabilityConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.LOG_LEVEL;
    delete process.env.NODE_ENV;
    delete process.env.PROCESS_ROLE;
    delete process.env.TELEGRAM_ALERTS_ENABLED;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_ALERT_CHAT_ID;
    delete process.env.TELEGRAM_API_BASE_URL;
    delete process.env.TELEGRAM_ALERT_TIMEOUT_MS;
    delete process.env.ALERT_COOLDOWN_CRITICAL_SECONDS;
    delete process.env.ALERT_COOLDOWN_WARN_SECONDS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('defaults', () => {
    it('returns safe defaults for development when environment variables are absent', () => {
      const config = observabilityConfig();

      expect(config).toEqual({
        logLevel: PinoLogLevels.INFO,
        nodeEnv: 'development',
        processRole: 'api',
        telegram: {
          enabled: false,
          botToken: undefined,
          chatId: undefined,
          apiBaseUrl: 'https://api.telegram.org',
          timeoutMs: 4000,
        },
        alerts: {
          cooldownSeconds: {
            critical: 900,
            warn: 1800,
          },
        },
      });
    });

    it('defaults logLevel to silent in test environment when LOG_LEVEL is omitted', () => {
      process.env.NODE_ENV = 'test';

      const config = observabilityConfig();

      expect(config.logLevel).toBe(PinoLogLevels.SILENT);
      expect(config.nodeEnv).toBe('test');
    });
  });

  describe('environment values', () => {
    it('reads telegram, log level, role and cooldown settings from environment variables', () => {
      process.env.NODE_ENV = 'production';
      process.env.PROCESS_ROLE = 'worker';
      process.env.LOG_LEVEL = PinoLogLevels.WARN;
      process.env.TELEGRAM_ALERTS_ENABLED = 'true';
      process.env.TELEGRAM_BOT_TOKEN = 'bot-token-value';
      process.env.TELEGRAM_ALERT_CHAT_ID = '-100123456789';
      process.env.TELEGRAM_API_BASE_URL = 'https://telegram-proxy.example.com/';
      process.env.TELEGRAM_ALERT_TIMEOUT_MS = '6500';
      process.env.ALERT_COOLDOWN_CRITICAL_SECONDS = '600';
      process.env.ALERT_COOLDOWN_WARN_SECONDS = '3600';

      const config = observabilityConfig();

      expect(config).toEqual({
        logLevel: PinoLogLevels.WARN,
        nodeEnv: 'production',
        processRole: 'worker',
        telegram: {
          enabled: true,
          botToken: 'bot-token-value',
          chatId: '-100123456789',
          apiBaseUrl: 'https://telegram-proxy.example.com',
          timeoutMs: 6500,
        },
        alerts: {
          cooldownSeconds: {
            critical: 600,
            warn: 3600,
          },
        },
      });
    });

    it('treats blank optional strings as undefined and falls back for invalid log levels', () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'verbose-invalid';
      process.env.TELEGRAM_BOT_TOKEN = '   ';
      process.env.TELEGRAM_ALERT_CHAT_ID = '';

      const config = observabilityConfig();

      expect(config.logLevel).toBe(PinoLogLevels.INFO);
      expect(config.telegram.botToken).toBeUndefined();
      expect(config.telegram.chatId).toBeUndefined();
    });
  });
});
