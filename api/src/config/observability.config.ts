import { ProcessRole, ProcessRoles } from '@/common/models/constants/process-role.constants';
import { AppStatus } from '@/common/models/enums';
import {
  DEFAULT_ALERT_COOLDOWN_CRITICAL_SECONDS,
  DEFAULT_ALERT_COOLDOWN_WARN_SECONDS,
  DEFAULT_TELEGRAM_ALERT_TIMEOUT_MS,
  DEFAULT_TELEGRAM_API_BASE_URL,
  type PinoLogLevel,
  PinoLogLevels,
  VALID_LOG_LEVELS,
} from '@/shared/observability/constants/observability.constants';
import { registerAs } from '@nestjs/config';

export { VALID_LOG_LEVELS, type PinoLogLevel };

export interface ObservabilityConfig {
  logLevel: PinoLogLevel;
  nodeEnv: string;
  processRole: ProcessRole;
  telegram: {
    enabled: boolean;
    botToken?: string;
    chatId?: string;
    apiBaseUrl: string;
    timeoutMs: number;
  };
  alerts: {
    cooldownSeconds: {
      critical: number;
      warn: number;
    };
  };
}

const readBoolean = (key: string, defaultValue: boolean): boolean => {
  const rawValue = process.env[key];

  if (rawValue === undefined) {
    return defaultValue;
  }

  return rawValue.toLowerCase() === 'true';
};

const readOptionalString = (key: string): string | undefined => {
  const value = process.env[key]?.trim();

  return value && value.length > 0 ? value : undefined;
};

const readNumber = (key: string, defaultValue: number): number => {
  const rawValue = process.env[key];

  if (rawValue === undefined || rawValue.trim() === '') {
    return defaultValue;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const readLogLevel = (nodeEnv: string): PinoLogLevel => {
  const rawLevel = process.env.LOG_LEVEL?.trim();

  if (rawLevel && (VALID_LOG_LEVELS as readonly string[]).includes(rawLevel)) {
    return rawLevel as PinoLogLevel;
  }

  return nodeEnv === String(AppStatus.TEST) ? PinoLogLevels.SILENT : PinoLogLevels.INFO;
};

const readProcessRole = (): ProcessRole => {
  return process.env.PROCESS_ROLE === ProcessRoles.WORKER ? ProcessRoles.WORKER : ProcessRoles.API;
};

export default registerAs('observability', (): ObservabilityConfig => {
  const nodeEnv = process.env.NODE_ENV?.trim() || AppStatus.DEVELOPMENT;
  const rawBaseUrl = readOptionalString('TELEGRAM_API_BASE_URL') ?? DEFAULT_TELEGRAM_API_BASE_URL;

  return {
    logLevel: readLogLevel(nodeEnv),
    nodeEnv,
    processRole: readProcessRole(),
    telegram: {
      enabled: readBoolean('TELEGRAM_ALERTS_ENABLED', false),
      botToken: readOptionalString('TELEGRAM_BOT_TOKEN'),
      chatId: readOptionalString('TELEGRAM_ALERT_CHAT_ID'),
      apiBaseUrl: rawBaseUrl.replace(/\/+$/, ''),
      timeoutMs: readNumber('TELEGRAM_ALERT_TIMEOUT_MS', DEFAULT_TELEGRAM_ALERT_TIMEOUT_MS),
    },
    alerts: {
      cooldownSeconds: {
        critical: readNumber('ALERT_COOLDOWN_CRITICAL_SECONDS', DEFAULT_ALERT_COOLDOWN_CRITICAL_SECONDS),
        warn: readNumber('ALERT_COOLDOWN_WARN_SECONDS', DEFAULT_ALERT_COOLDOWN_WARN_SECONDS),
      },
    },
  };
});
