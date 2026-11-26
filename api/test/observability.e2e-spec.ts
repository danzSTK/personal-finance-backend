import { AppExceptionFilter } from '@/common/filters';
import { HealthController } from '@/modules/health/health.controller';
import { RedisHealthIndicator } from '@/modules/health/indicators/redis-health-indicator';
import {
  OPERATIONAL_ALERT_NOTIFIER,
  ObservabilityLogEvents,
  ObservabilityModule,
  OperationalAlertKeys,
  OperationalAlertService,
  OperationalAlertSeverities,
  PinoLogLevels,
  REQUEST_ID_HEADER,
  getObservabilityContext,
} from '@/shared/observability';
import { Controller, Get, INestApplication, BadRequestException } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HealthCheckService, MemoryHealthIndicator, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';

@Controller('observability-test')
class ObservabilityTestController {
  @Get('ok')
  ok(): { ok: boolean; requestId?: string } {
    return {
      ok: true,
      requestId: getObservabilityContext()?.requestId,
    };
  }

  @Get('items/:id/boom')
  boom(): never {
    throw new Error('Simulated unhandled failure');
  }

  @Get('bad-request')
  badRequest(): never {
    throw new BadRequestException('Invalid test input');
  }
}

describe('Observability HTTP contract (e2e)', () => {
  const originalEnv = process.env;
  let app: INestApplication;
  let operationalAlertService: OperationalAlertService;
  let notifySpy: jest.SpyInstance;

  beforeAll(async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PROCESS_ROLE: 'api',
      LOG_LEVEL: PinoLogLevels.SILENT,
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ObservabilityModule.forApi()],
      controllers: [HealthController, ObservabilityTestController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn().mockResolvedValue({
              status: 'ok',
              info: {},
              error: {},
              details: {},
            }),
          },
        },
        { provide: TypeOrmHealthIndicator, useValue: { pingCheck: jest.fn() } },
        { provide: MemoryHealthIndicator, useValue: { checkHeap: jest.fn() } },
        { provide: RedisHealthIndicator, useValue: { isHealthy: jest.fn() } },
        { provide: APP_FILTER, useClass: AppExceptionFilter },
      ],
    }).compile();

    app = moduleFixture.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    await app.init();

    operationalAlertService = app.get(OperationalAlertService);
    notifySpy = jest.spyOn(operationalAlertService, 'notify');
  });

  afterAll(async () => {
    await app?.close();
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serves /health/liveness without Telegram dependencies and returns X-Request-Id', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    const res = await request(httpServer).get('/health/liveness').expect(200);

    expect(res.body).toEqual({
      status: 'ok',
      info: {},
      error: {},
      details: {},
    });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
    expect(app.get(OPERATIONAL_ALERT_NOTIFIER)).toBeDefined();
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('echoes valid client X-Request-Id and propagates it inside AsyncLocalStorage', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    const clientRequestId = 'frontend-trace_2026.01';

    const res = await request(httpServer)
      .get('/observability-test/ok')
      .set(REQUEST_ID_HEADER, clientRequestId)
      .expect(200);

    expect(res.headers['x-request-id']).toBe(clientRequestId);
    expect(res.body).toEqual({
      ok: true,
      requestId: clientRequestId,
    });
  });

  it('replaces invalid or oversized X-Request-Id values with a generated UUID', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    const res = await request(httpServer)
      .get('/observability-test/ok')
      .set(REQUEST_ID_HEADER, 'invalid space value!')
      .expect(200);

    const responseId = res.headers['x-request-id'];
    expect(responseId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(responseId).not.toBe('invalid space value!');
    expect((res.body as { requestId: string }).requestId).toBe(responseId);
  });

  it('triggers CRITICAL operational alert on unhandled 500 error with normalized route and skips 4xx errors', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    await request(httpServer).get('/observability-test/bad-request').expect(400);
    expect(notifySpy).not.toHaveBeenCalled();

    const errorRes = await request(httpServer)
      .get('/observability-test/items/550e8400-e293-41d4-a716-446655440000/boom')
      .set(REQUEST_ID_HEADER, 'trace-500-e2e')
      .expect(500);

    expect(errorRes.headers['x-request-id']).toBe('trace-500-e2e');
    expect(notifySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        alertKey: OperationalAlertKeys.http500('GET', '/observability-test/items/:id/boom'),
        event: ObservabilityLogEvents.UNHANDLED_HTTP_EXCEPTION,
        severity: OperationalAlertSeverities.CRITICAL,
        requestId: 'trace-500-e2e',
      }),
    );
  });
});
