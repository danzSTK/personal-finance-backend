import { type ProcessRole, ProcessRoles } from '@/common/models/constants/process-role.constants';
import { AppStatus } from '@/common/models/enums';
import observabilityConfig, { type ObservabilityConfig } from '@/config/observability.config';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { NoopOperationalAlertNotifier } from '@/shared/observability/alerts/noop-operational-alert.notifier';
import { OperationalAlertService } from '@/shared/observability/alerts/operational-alert.service';
import { TelegramOperationalAlertNotifier } from '@/shared/observability/alerts/telegram-operational-alert.notifier';
import { runWithRequestLogContext } from '@/shared/observability/context/observability-context';
import { METRICS_RECORDER } from '@/shared/observability/contracts/metrics-recorder.interface';
import {
  IOperationalAlertNotifier,
  OPERATIONAL_ALERT_NOTIFIER,
} from '@/shared/observability/contracts/operational-alert-notifier.interface';
import { createPinoHttpOptions, resolveRequestId } from '@/shared/observability/logging/pino-logger.config';
import { StructuredLogMetricsRecorder } from '@/shared/observability/metrics/structured-log-metrics.recorder';
import {
  DynamicModule,
  Global,
  Inject,
  Injectable,
  Logger,
  MiddlewareConsumer,
  Module,
  NestMiddleware,
  NestModule,
  Optional,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { LoggerModule } from 'nestjs-pino';

const OBSERVABILITY_PROCESS_ROLE = Symbol('OBSERVABILITY_PROCESS_ROLE');

@Injectable()
export class ObservabilityRequestContextMiddleware implements NestMiddleware {
  use(req: Request & { id?: unknown }, res: Response, next: NextFunction): void {
    const requestId = resolveRequestId(req, res);
    runWithRequestLogContext(requestId, () => {
      next();
    });
  }
}

@Global()
@Module({})
export class ObservabilityModule implements NestModule {
  constructor(
    @Optional()
    @Inject(OBSERVABILITY_PROCESS_ROLE)
    private readonly processRole?: ProcessRole,
  ) {}

  static forApi(): DynamicModule {
    return ObservabilityModule.createModule(ProcessRoles.API);
  }

  static forWorker(): DynamicModule {
    return ObservabilityModule.createModule(ProcessRoles.WORKER);
  }

  private static createModule(processRole: ProcessRole): DynamicModule {
    return {
      module: ObservabilityModule,
      imports: [
        NestConfigModule.forFeature(observabilityConfig),
        LoggerModule.forRootAsync({
          imports: [NestConfigModule.forFeature(observabilityConfig)],
          inject: [observabilityConfig.KEY],
          useFactory: (config: ObservabilityConfig) => ({
            pinoHttp: createPinoHttpOptions({
              ...config,
              processRole,
            }),
          }),
        }),
      ],
      providers: [
        {
          provide: OBSERVABILITY_PROCESS_ROLE,
          useValue: processRole,
        },
        ObservabilityRequestContextMiddleware,
        StructuredLogMetricsRecorder,
        {
          provide: METRICS_RECORDER,
          useExisting: StructuredLogMetricsRecorder,
        },
        NoopOperationalAlertNotifier,
        TelegramOperationalAlertNotifier,
        {
          provide: OPERATIONAL_ALERT_NOTIFIER,
          inject: [observabilityConfig.KEY, TelegramOperationalAlertNotifier, NoopOperationalAlertNotifier],
          useFactory: (
            config: ObservabilityConfig,
            telegramNotifier: TelegramOperationalAlertNotifier,
            noopNotifier: NoopOperationalAlertNotifier,
          ): IOperationalAlertNotifier => {
            if (config.nodeEnv === String(AppStatus.TEST)) {
              return noopNotifier;
            }

            if (!config.telegram.enabled) {
              return noopNotifier;
            }

            if (!config.telegram.botToken || !config.telegram.chatId) {
              new Logger(ObservabilityModule.name).warn(
                'TELEGRAM_ALERTS_ENABLED=true but TELEGRAM_BOT_TOKEN or TELEGRAM_ALERT_CHAT_ID is missing; falling back to NoopOperationalAlertNotifier.',
              );
              return noopNotifier;
            }

            return telegramNotifier;
          },
        },
        OperationalAlertService,
      ],
      exports: [LoggerModule, METRICS_RECORDER, OPERATIONAL_ALERT_NOTIFIER, OperationalAlertService],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    if (this.processRole === ProcessRoles.API) {
      consumer.apply(ObservabilityRequestContextMiddleware).forRoutes('/{*splat}');
    }
  }
}
