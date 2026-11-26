import type { ObservabilityConfig } from '@/config/observability.config';
import {
  formatTelegramAlertMessage,
  TelegramOperationalAlertNotifier,
} from '@/shared/observability/alerts/telegram-operational-alert.notifier';
import {
  EnvironmentLabels,
  ObservabilityLogEvents,
  OperationalAlertKeys,
  OperationalAlertSeverities,
  PinoLogLevels,
  REDACTED_VALUE,
} from '@/shared/observability/constants/observability.constants';
import { FormattedOperationalAlert } from '@/shared/observability/contracts/operational-alert-notifier.interface';

describe('TelegramOperationalAlertNotifier', () => {
  const originalFetch = global.fetch;

  const baseConfig: ObservabilityConfig = {
    logLevel: PinoLogLevels.INFO,
    nodeEnv: 'production',
    processRole: 'api',
    telegram: {
      enabled: true,
      botToken: '123456:secret-bot-token',
      chatId: '-100999888777',
      apiBaseUrl: 'https://api.telegram.org',
      timeoutMs: 4000,
    },
    alerts: {
      cooldownSeconds: {
        critical: 900,
        warn: 1800,
      },
    },
  };

  const sampleAlert: FormattedOperationalAlert = {
    alertKey: OperationalAlertKeys.http500('POST', '/transactions'),
    event: ObservabilityLogEvents.UNHANDLED_HTTP_EXCEPTION,
    severity: OperationalAlertSeverities.CRITICAL,
    title: 'Erro interno inesperado na API (500)',
    summary: 'POST /transactions falhou com erro inesperado.',
    environment: EnvironmentLabels.PRODUCTION,
    processRole: 'api',
    requestId: '550e8400-e293-41d4-a716-446655440000',
    timestamp: '2026-11-26T15:00:00.000Z',
    metadata: {
      method: 'POST',
      route: '/transactions',
      statusCode: 500,
    },
  };

  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('formatTelegramAlertMessage', () => {
    it('formats environment prefix, severity, correlation ids and redacts sensitive metadata keys', () => {
      const text = formatTelegramAlertMessage({
        ...sampleAlert,
        metadata: {
          method: 'POST',
          password: 'secret-password',
          cpf: '12345678901',
        },
      });

      expect(text).toContain(
        `🚨 [${EnvironmentLabels.PRODUCTION}] [${OperationalAlertSeverities.CRITICAL}] API — ${ObservabilityLogEvents.UNHANDLED_HTTP_EXCEPTION}`,
      );
      expect(text).toContain(`• alertKey: ${OperationalAlertKeys.http500('POST', '/transactions')}`);
      expect(text).toContain('• requestId: 550e8400-e293-41d4-a716-446655440000');
      expect(text).toContain('• processRole: api');
      expect(text).toContain('• time: 2026-11-26T15:00:00.000Z');
      expect(text).toContain('• method: POST');
      expect(text).toContain(`• password: ${REDACTED_VALUE}`);
      expect(text).toContain(`• cpf: ${REDACTED_VALUE}`);
      expect(text).not.toContain('secret-password');
      expect(text).not.toContain('12345678901');
    });
  });

  describe('send', () => {
    it('posts formatted plain text alert to Telegram Bot API with timeout signal', async () => {
      const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');
      const notifier = new TelegramOperationalAlertNotifier(baseConfig);

      await notifier.send(sampleAlert);

      expect(timeoutSpy).toHaveBeenCalledWith(4000);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.telegram.org/bot123456:secret-bot-token/sendMessage');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(init.signal).toBeInstanceOf(AbortSignal);

      const parsedBody = JSON.parse(init.body as string) as {
        chat_id: string;
        text: string;
        disable_web_page_preview: boolean;
      };
      expect(parsedBody.chat_id).toBe('-100999888777');
      expect(parsedBody.disable_web_page_preview).toBe(true);
      expect(parsedBody.text).toContain(`[${EnvironmentLabels.PRODUCTION}] [${OperationalAlertSeverities.CRITICAL}]`);

      timeoutSpy.mockRestore();
    });

    it('throws HTTP status error without leaking botToken when Telegram returns >= 400', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 429,
      } as Response);
      const notifier = new TelegramOperationalAlertNotifier(baseConfig);

      await expect(notifier.send(sampleAlert)).rejects.toThrow('Telegram Bot API responded with HTTP 429');

      try {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
        await notifier.send(sampleAlert);
      } catch (error) {
        expect((error as Error).message).not.toContain('123456:secret-bot-token');
      }
    });

    it('sanitizes botToken if fetch rejects with an error containing the token', async () => {
      fetchMock.mockRejectedValueOnce(
        new Error('Request to https://api.telegram.org/bot123456:secret-bot-token/sendMessage timed out'),
      );
      const notifier = new TelegramOperationalAlertNotifier(baseConfig);

      let caught: Error | undefined;
      try {
        await notifier.send(sampleAlert);
      } catch (error) {
        caught = error as Error;
      }

      expect(caught).toBeInstanceOf(Error);
      expect(caught?.message).toContain(REDACTED_VALUE);
      expect(caught?.message).not.toContain('123456:secret-bot-token');
    });
  });
});
