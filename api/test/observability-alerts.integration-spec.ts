/* eslint-disable @typescript-eslint/unbound-method */
import { CacheKeys } from '@/common/utils/cache-keys.factory';
import type { ObservabilityConfig } from '@/config/observability.config';
import { RedisService } from '@/database/redis/redis.service';
import {
  IOperationalAlertNotifier,
  ObservabilityLogEvents,
  OperationalAlertKeys,
  OperationalAlertService,
  OperationalAlertSeverities,
  PinoLogLevels,
} from '@/shared/observability';
import { Logger } from '@nestjs/common';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';

describe('Operational alerts Redis cooldown integration', () => {
  const password = 'observability-alerts-integration';
  let container: StartedRedisContainer | undefined;
  let client: Redis | undefined;
  let redisService: RedisService | undefined;
  let notifier: jest.Mocked<IOperationalAlertNotifier>;
  let service: OperationalAlertService;

  const config: ObservabilityConfig = {
    logLevel: PinoLogLevels.SILENT,
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

  beforeAll(async () => {
    container = await new RedisContainer('redis:7-alpine').withPassword(password).start();
    client = new Redis({
      host: container.getHost(),
      port: container.getPort(),
      password,
      maxRetriesPerRequest: 1,
    });
    redisService = new RedisService(client);
  });

  afterAll(async () => {
    if (client) {
      if (client.status === 'ready') {
        await client.quit();
      } else {
        client.disconnect();
      }
    }
    await container?.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await client!.flushdb();

    notifier = {
      send: jest.fn().mockResolvedValue(undefined),
    };
    service = new OperationalAlertService(notifier, config, redisService);
  });

  it('acquires Redis cooldown via SET NX EX, suppresses duplicates and resets on RESOLVED', async () => {
    const alertKey = OperationalAlertKeys.http500('POST', '/transactions');
    const cooldownKey = CacheKeys.observability.alertCooldown(alertKey);

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
      summary: 'Segunda falha dentro do cooldown',
    });

    expect(notifier.send).toHaveBeenCalledTimes(1);
    await expect(client!.get(cooldownKey)).resolves.toBe('1');
    await expect(client!.ttl(cooldownKey)).resolves.toBeGreaterThan(800);

    await service.notifyAsync({
      alertKey,
      event: 'HTTP_RECOVERED',
      severity: OperationalAlertSeverities.RESOLVED,
      title: 'Rota recuperada',
      summary: 'Voltou a responder',
    });

    await expect(client!.exists(cooldownKey)).resolves.toBe(0);
    expect(notifier.send).toHaveBeenCalledTimes(2);

    await service.notifyAsync({
      alertKey,
      event: ObservabilityLogEvents.UNHANDLED_HTTP_EXCEPTION,
      severity: OperationalAlertSeverities.CRITICAL,
      title: 'Erro 500',
      summary: 'Nova ocorrência após RESOLVED',
    });

    expect(notifier.send).toHaveBeenCalledTimes(3);
  });

  it('falls back to in-memory cooldown when Redis fails without throwing', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const failingRedisClient = {
      set: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
    };
    const brokenRedisService = {
      getClient: () => failingRedisClient,
      del: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
    } as unknown as RedisService;

    const resilientService = new OperationalAlertService(notifier, config, brokenRedisService);

    await resilientService.notifyAsync({
      alertKey: 'worker:redis:fallback',
      event: 'TEST_FALLBACK',
      severity: OperationalAlertSeverities.WARN,
      title: 'Aviso',
      summary: 'Primeiro envio sem Redis',
    });

    await resilientService.notifyAsync({
      alertKey: 'worker:redis:fallback',
      event: 'TEST_FALLBACK',
      severity: OperationalAlertSeverities.WARN,
      title: 'Aviso',
      summary: 'Segundo envio bloqueado em memória',
    });

    expect(notifier.send).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: ObservabilityLogEvents.OPERATIONAL_ALERT_COOLDOWN_REDIS_ERROR,
      }),
    );

    warnSpy.mockRestore();
  });
});
