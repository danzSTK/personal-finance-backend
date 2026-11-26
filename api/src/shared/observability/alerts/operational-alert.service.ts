import { AppStatus } from '@/common/models/enums';
import { CacheKeys } from '@/common/utils/cache-keys.factory';
import observabilityConfig, { type ObservabilityConfig } from '@/config/observability.config';
import { RedisService } from '@/database/redis/redis.service';
import {
  EnvironmentLabels,
  MEMORY_COOLDOWN_MAX_ENTRIES,
  ObservabilityLogEvents,
  OperationalAlertSeverities,
  type OperationalAlertSeverity,
} from '@/shared/observability/constants/observability.constants';
import { getObservabilityContext } from '@/shared/observability/context/observability-context';
import {
  type FormattedOperationalAlert,
  type IOperationalAlertNotifier,
  OPERATIONAL_ALERT_NOTIFIER,
  type OperationalAlertInput,
} from '@/shared/observability/contracts/operational-alert-notifier.interface';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

const ENVIRONMENT_LABELS: Record<string, string> = {
  [AppStatus.PRODUCTION]: EnvironmentLabels.PRODUCTION,
  staging: EnvironmentLabels.STAGING,
  [AppStatus.DEVELOPMENT]: EnvironmentLabels.DEVELOPMENT,
  [AppStatus.TEST]: EnvironmentLabels.TEST,
};

@Injectable()
export class OperationalAlertService {
  private readonly logger = new Logger(OperationalAlertService.name);
  private readonly memoryCooldowns = new Map<string, number>();

  constructor(
    @Inject(OPERATIONAL_ALERT_NOTIFIER)
    private readonly notifier: IOperationalAlertNotifier,
    @Inject(observabilityConfig.KEY)
    private readonly config: ObservabilityConfig,
    @Optional()
    private readonly redisService?: RedisService,
  ) {}

  notify(input: OperationalAlertInput): void {
    void this.notifyAsync(input);
  }

  async notifyAsync(input: OperationalAlertInput): Promise<void> {
    try {
      const alert = this.enrichAlert(input);
      const cooldownKey = CacheKeys.observability.alertCooldown(alert.alertKey);

      if (alert.severity === OperationalAlertSeverities.RESOLVED) {
        await this.clearCooldown(alert.alertKey, cooldownKey);
      } else {
        const ttlSeconds = this.resolveCooldownSeconds(alert);
        const acquired = await this.tryAcquireCooldown(alert.alertKey, cooldownKey, ttlSeconds, alert.severity);

        if (!acquired) {
          this.logger.log({
            event: ObservabilityLogEvents.OPERATIONAL_ALERT_SUPPRESSED,
            alertKey: alert.alertKey,
            severity: alert.severity,
          });
          return;
        }
      }

      try {
        await this.notifier.send(alert);
      } catch (error) {
        this.logger.warn({
          event: ObservabilityLogEvents.OPERATIONAL_ALERT_DELIVERY_FAILED,
          alertKey: alert.alertKey,
          severity: alert.severity,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    } catch (error) {
      this.logger.warn({
        event: ObservabilityLogEvents.OPERATIONAL_ALERT_DELIVERY_FAILED,
        alertKey: input.alertKey,
        severity: input.severity,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private enrichAlert(input: OperationalAlertInput): FormattedOperationalAlert {
    const context = getObservabilityContext();
    const environment = ENVIRONMENT_LABELS[this.config.nodeEnv.toLowerCase()] ?? this.config.nodeEnv.toUpperCase();

    return {
      ...input,
      requestId: input.requestId ?? context?.requestId,
      jobId: input.jobId ?? context?.jobId,
      environment,
      processRole: this.config.processRole,
      timestamp: new Date().toISOString(),
    };
  }

  private resolveCooldownSeconds(alert: FormattedOperationalAlert): number {
    if (alert.cooldownSeconds !== undefined && alert.cooldownSeconds > 0) {
      return alert.cooldownSeconds;
    }

    return alert.severity === OperationalAlertSeverities.CRITICAL
      ? this.config.alerts.cooldownSeconds.critical
      : this.config.alerts.cooldownSeconds.warn;
  }

  private async clearCooldown(alertKey: string, cooldownKey: string): Promise<void> {
    this.memoryCooldowns.delete(alertKey);

    if (!this.redisService) {
      return;
    }

    try {
      await this.redisService.del(cooldownKey);
    } catch (error) {
      this.logger.warn({
        event: ObservabilityLogEvents.OPERATIONAL_ALERT_COOLDOWN_REDIS_ERROR,
        alertKey,
        severity: OperationalAlertSeverities.RESOLVED,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async tryAcquireCooldown(
    alertKey: string,
    cooldownKey: string,
    ttlSeconds: number,
    severity: Exclude<OperationalAlertSeverity, typeof OperationalAlertSeverities.RESOLVED>,
  ): Promise<boolean> {
    if (this.redisService) {
      try {
        const result = await this.redisService.getClient().set(cooldownKey, '1', 'EX', ttlSeconds, 'NX');
        return result === 'OK';
      } catch (error) {
        this.logger.warn({
          event: ObservabilityLogEvents.OPERATIONAL_ALERT_COOLDOWN_REDIS_ERROR,
          alertKey,
          severity,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return this.tryAcquireMemoryCooldown(alertKey, ttlSeconds);
  }

  private tryAcquireMemoryCooldown(alertKey: string, ttlSeconds: number): boolean {
    const now = Date.now();
    const existingExpiry = this.memoryCooldowns.get(alertKey);

    if (existingExpiry !== undefined) {
      if (existingExpiry > now) {
        return false;
      }

      this.memoryCooldowns.delete(alertKey);
    }

    if (this.memoryCooldowns.size >= MEMORY_COOLDOWN_MAX_ENTRIES) {
      for (const [key, expiresAt] of this.memoryCooldowns.entries()) {
        if (expiresAt <= now) {
          this.memoryCooldowns.delete(key);
        }
      }

      if (this.memoryCooldowns.size >= MEMORY_COOLDOWN_MAX_ENTRIES) {
        const oldestEntry = this.memoryCooldowns.keys().next();
        if (!oldestEntry.done) {
          this.memoryCooldowns.delete(oldestEntry.value);
        }
      }
    }

    this.memoryCooldowns.set(alertKey, now + ttlSeconds * 1000);
    return true;
  }
}
