/* eslint-disable @typescript-eslint/unbound-method */
import { CacheKeys } from '@/common/utils/cache-keys.factory';
import type { ObservabilityConfig } from '@/config/observability.config';
import { RedisService } from '@/database/redis/redis.service';
import { OperationalAlertService } from '@/shared/observability/alerts/operational-alert.service';
import {
  EnvironmentLabels,
  ObservabilityLogEvents,
  OperationalAlertKeys,
  OperationalAlertSeverities,
  PinoLogLevels,
} from '@/shared/observability/constants/observability.constants';
import { runWithJobLogContext, runWithRequestLogContext } from '@/shared/observability/context/observability-context';
import { IOperationalAlertNotifier } from '@/shared/observability/contracts/operational-alert-notifier.interface';
import { Logger } from '@nestjs/common';

describe('OperationalAlertService', () => {
  const baseConfig: ObservabilityConfig = {
    logLevel: PinoLogLevels.INFO,
    nodeEnv: 'production',
    processRole: 'api',
    telegram: {
      enabled: true,
      botToken: 'bot-token',
      chatId: 'chat-id',
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

  let notifier: jest.Mocked<IOperationalAlertNotifier>;
  let redisClient: { set: jest.Mock };
  let redisService: jest.Mocked<Pick<RedisService, 'getClient' | 'del'>>;
  let service: OperationalAlertService;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    notifier = {
      send: jest.fn().mockResolvedValue(undefined),
    };
    redisClient = {
      set: jest.fn().mockResolvedValue('OK'),
    };
    redisService = {
      getClient: jest.fn().mockReturnValue(redisClient),
      del: jest.fn().mockResolvedValue(undefined),
    };

    service = new OperationalAlertService(notifier, baseConfig, redisService as unknown as RedisService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('cooldown and deduplication', () => {
    it('acquires Redis cooldown via SET NX EX and sends alert when key is newly set', async () => {
      const alertKey = OperationalAlertKeys.http500('POST', '/transactions');

      await service.notifyAsync({
        alertKey,
        event: ObservabilityLogEvents.UNHANDLED_HTTP_EXCEPTION,
        severity: OperationalAlertSeverities.CRITICAL,
        title: 'Erro 500',
        summary: 'Falha inesperada',
      });

      expect(redisClient.set).toHaveBeenCalledWith(
        CacheKeys.observability.alertCooldown(alertKey),
        '1',
        'EX',
        900,
        'NX',
      );
      expect(notifier.send).toHaveBeenCalledWith(
        expect.objectContaining({
          alertKey,
          environment: EnvironmentLabels.PRODUCTION,
          processRole: 'api',
          severity: OperationalAlertSeverities.CRITICAL,
          timestamp: expect.any(String) as string,
        }),
      );
    });

    it('uses WARN default cooldown when severity is WARN', async () => {
      await service.notifyAsync({
        alertKey: 'worker:queue:lag',
        event: 'QUEUE_LAG_HIGH',
        severity: OperationalAlertSeverities.WARN,
        title: 'Lag elevado',
        summary: 'Fila acima do limiar',
      });

      expect(redisClient.set).toHaveBeenCalledWith(
        CacheKeys.observability.alertCooldown('worker:queue:lag'),
        '1',
        'EX',
        1800,
        'NX',
      );
      expect(notifier.send).toHaveBeenCalledTimes(1);
    });

    it('suppresses duplicate alerts when Redis SET NX returns null', async () => {
      redisClient.set.mockResolvedValueOnce(null);
      const alertKey = OperationalAlertKeys.http500('GET', '/accounts');

      await service.notifyAsync({
        alertKey,
        event: ObservabilityLogEvents.UNHANDLED_HTTP_EXCEPTION,
        severity: OperationalAlertSeverities.CRITICAL,
        title: 'Erro 500',
        summary: 'Falha repetida',
      });

      expect(notifier.send).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith({
        event: ObservabilityLogEvents.OPERATIONAL_ALERT_SUPPRESSED,
        alertKey,
        severity: OperationalAlertSeverities.CRITICAL,
      });
    });

    it('clears cooldown key on RESOLVED and dispatches notification immediately', async () => {
      await service.notifyAsync({
        alertKey: 'sefaz:outage',
        event: 'SEFAZ_RECOVERED',
        severity: OperationalAlertSeverities.RESOLVED,
        title: 'SEFAZ normalizada',
        summary: 'Serviço voltou a responder.',
      });

      expect(redisService.del).toHaveBeenCalledWith(CacheKeys.observability.alertCooldown('sefaz:outage'));
      expect(redisClient.set).not.toHaveBeenCalled();
      expect(notifier.send).toHaveBeenCalledWith(
        expect.objectContaining({
          alertKey: 'sefaz:outage',
          severity: OperationalAlertSeverities.RESOLVED,
        }),
      );
    });
  });

  describe('context enrichment', () => {
    it('automatically attaches requestId from AsyncLocalStorage when not explicitly provided', async () => {
      await runWithRequestLogContext('req-from-als', async () => {
        await service.notifyAsync({
          alertKey: OperationalAlertKeys.http500('GET', '/test'),
          event: ObservabilityLogEvents.UNHANDLED_HTTP_EXCEPTION,
          severity: OperationalAlertSeverities.CRITICAL,
          title: 'Erro 500',
          summary: 'Falha',
        });
      });

      expect(notifier.send).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-from-als',
        }),
      );
    });

    it('automatically attaches jobId from AsyncLocalStorage when executing inside worker job context', async () => {
      await runWithJobLogContext({ jobId: 'job-99', queueName: 'email', jobName: 'send' }, async () => {
        await service.notifyAsync({
          alertKey: 'worker:email:fail',
          event: 'JOB_FAILED',
          severity: OperationalAlertSeverities.WARN,
          title: 'Falha no job',
          summary: 'Erro transitório',
        });
      });

      expect(notifier.send).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-99',
        }),
      );
    });
  });

  describe('resilience and isolation', () => {
    it('falls back to in-memory cooldown when Redis fails without throwing or flooding', async () => {
      redisClient.set.mockRejectedValue(new Error('Redis connection refused'));
      const alertKey = OperationalAlertKeys.http500('POST', '/categories');

      await service.notifyAsync({
        alertKey,
        event: ObservabilityLogEvents.UNHANDLED_HTTP_EXCEPTION,
        severity: OperationalAlertSeverities.CRITICAL,
        title: 'Erro 500',
        summary: 'Primeira falha',
      });

      await service.notifyAsync({
        alertKey,
        event: ObservabilityLogEvents.UNHANDLED_HTTP_EXCEPTION,
        severity: OperationalAlertSeverities.CRITICAL,
        title: 'Erro 500',
        summary: 'Segunda falha',
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: ObservabilityLogEvents.OPERATIONAL_ALERT_COOLDOWN_REDIS_ERROR,
          alertKey,
        }),
      );
      expect(notifier.send).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith({
        event: ObservabilityLogEvents.OPERATIONAL_ALERT_SUPPRESSED,
        alertKey,
        severity: OperationalAlertSeverities.CRITICAL,
      });
    });

    it('never throws when notifier fails and logs OPERATIONAL_ALERT_DELIVERY_FAILED', async () => {
      notifier.send.mockRejectedValueOnce(new Error('Telegram timeout'));
      const alertKey = OperationalAlertKeys.http500('GET', '/broken');

      await expect(
        service.notifyAsync({
          alertKey,
          event: ObservabilityLogEvents.UNHANDLED_HTTP_EXCEPTION,
          severity: OperationalAlertSeverities.CRITICAL,
          title: 'Erro 500',
          summary: 'Falha',
        }),
      ).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalledWith({
        event: ObservabilityLogEvents.OPERATIONAL_ALERT_DELIVERY_FAILED,
        alertKey,
        severity: OperationalAlertSeverities.CRITICAL,
        errorMessage: 'Telegram timeout',
      });
    });

    it('runs fire-and-forget notify without throwing synchronously or rejecting', async () => {
      notifier.send.mockRejectedValueOnce(new Error('Network down'));

      expect(() =>
        service.notify({
          alertKey: 'api:fire-and-forget',
          event: 'TEST_EVENT',
          severity: OperationalAlertSeverities.CRITICAL,
          title: 'Test',
          summary: 'Summary',
        }),
      ).not.toThrow();

      await Promise.resolve();
      await Promise.resolve();
    });
  });
});
