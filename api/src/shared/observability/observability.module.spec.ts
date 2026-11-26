import observabilityConfig, { type ObservabilityConfig } from '@/config/observability.config';
import {
  METRICS_RECORDER,
  NoopOperationalAlertNotifier,
  OPERATIONAL_ALERT_NOTIFIER,
  ObservabilityModule,
  OperationalAlertService,
  StructuredLogMetricsRecorder,
  TelegramOperationalAlertNotifier,
} from '@/shared/observability';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';

describe('ObservabilityModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PROCESS_ROLE: 'api',
      TELEGRAM_ALERTS_ENABLED: 'true',
      TELEGRAM_BOT_TOKEN: '123456:test-token',
      TELEGRAM_ALERT_CHAT_ID: '-10012345',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('always resolves NoopOperationalAlertNotifier in NODE_ENV=test even when Telegram credentials are set', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ObservabilityModule.forApi()],
    }).compile();

    expect(moduleRef.get(OperationalAlertService)).toBeInstanceOf(OperationalAlertService);
    expect(moduleRef.get(METRICS_RECORDER)).toBeInstanceOf(StructuredLogMetricsRecorder);
    expect(moduleRef.get(OPERATIONAL_ALERT_NOTIFIER)).toBeInstanceOf(NoopOperationalAlertNotifier);

    await moduleRef.close();
  });

  it('activates TelegramOperationalAlertNotifier outside test when enabled with token and chatId', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PROCESS_ROLE = 'worker';

    const moduleRef = await Test.createTestingModule({
      imports: [ObservabilityModule.forWorker()],
    }).compile();

    expect(moduleRef.get(OPERATIONAL_ALERT_NOTIFIER)).toBeInstanceOf(TelegramOperationalAlertNotifier);
    expect(moduleRef.get<ObservabilityConfig>(observabilityConfig.KEY).processRole).toBe('worker');

    await moduleRef.close();
  });

  it('falls back to NoopOperationalAlertNotifier with a boot warning when enabled but credentials are missing', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    process.env.NODE_ENV = 'development';
    delete process.env.TELEGRAM_BOT_TOKEN;

    const moduleRef = await Test.createTestingModule({
      imports: [ObservabilityModule.forApi()],
    }).compile();

    expect(moduleRef.get(OPERATIONAL_ALERT_NOTIFIER)).toBeInstanceOf(NoopOperationalAlertNotifier);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'TELEGRAM_ALERTS_ENABLED=true but TELEGRAM_BOT_TOKEN or TELEGRAM_ALERT_CHAT_ID is missing',
      ),
    );

    await moduleRef.close();
    warnSpy.mockRestore();
  });
});
