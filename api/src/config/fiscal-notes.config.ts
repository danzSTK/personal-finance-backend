import { registerAs } from '@nestjs/config';
import Joi from 'joi';

export const FISCAL_NOTES_CONFIG_KEY = 'fiscalNotes';

export const DEFAULT_FISCAL_NOTES_SEFAZ_CE_BASE_URL = 'http://nfce.sefaz.ce.gov.br';
export const DEFAULT_FISCAL_NOTES_HTTP_TIMEOUT_MS = 7000;
export const DEFAULT_FISCAL_NOTES_HTTP_RETRY_BACKOFF_MS = 400;
export const DEFAULT_FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES = 1_048_576;
export const DEFAULT_FISCAL_NOTES_CACHE_TTL_SECONDS = 1200;
export const DEFAULT_FISCAL_NOTES_RL_USER_PER_MINUTE = 5;
export const DEFAULT_FISCAL_NOTES_RL_USER_PER_HOUR = 30;
export const DEFAULT_FISCAL_NOTES_RL_GLOBAL_PER_MINUTE = 40;
export const DEFAULT_FISCAL_NOTES_CB_FAILURE_THRESHOLD = 5;
export const DEFAULT_FISCAL_NOTES_CB_COOLDOWN_SECONDS = [60, 120, 300] as const;
export const MIN_FISCAL_NOTES_CB_COOLDOWN_SECOND = 5;

export interface FiscalNotesConfig {
  sefazCe: {
    baseUrl: string;
  };
  http: {
    timeoutMs: number;
    retryBackoffMs: number;
    maxResponseBytes: number;
  };
  cache: {
    ttlSeconds: number;
  };
  rateLimit: {
    userPerMinute: number;
    userPerHour: number;
    globalPerMinute: number;
  };
  circuitBreaker: {
    failureThreshold: number;
    cooldownSeconds: number[];
  };
}

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

export const parseFiscalNotesCooldownSecondsCsv = (rawValue: string): number[] | null => {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parts = trimmed.split(',').map(part => part.trim());
  const parsedValues: number[] = [];

  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return null;
    }

    const numericValue = Number(part);
    if (!Number.isSafeInteger(numericValue) || numericValue < MIN_FISCAL_NOTES_CB_COOLDOWN_SECOND) {
      return null;
    }

    parsedValues.push(numericValue);
  }

  return parsedValues.length > 0 ? parsedValues : null;
};

const readCooldownSeconds = (): number[] => {
  const rawValue = readOptionalString('FISCAL_NOTES_CB_COOLDOWN_SECONDS');

  if (!rawValue) {
    return [...DEFAULT_FISCAL_NOTES_CB_COOLDOWN_SECONDS];
  }

  return parseFiscalNotesCooldownSecondsCsv(rawValue) ?? [...DEFAULT_FISCAL_NOTES_CB_COOLDOWN_SECONDS];
};

export default registerAs(FISCAL_NOTES_CONFIG_KEY, (): FiscalNotesConfig => {
  const rawBaseUrl = readOptionalString('FISCAL_NOTES_SEFAZ_CE_BASE_URL') ?? DEFAULT_FISCAL_NOTES_SEFAZ_CE_BASE_URL;

  return {
    sefazCe: {
      baseUrl: rawBaseUrl.replace(/\/+$/, ''),
    },
    http: {
      timeoutMs: readNumber('FISCAL_NOTES_HTTP_TIMEOUT_MS', DEFAULT_FISCAL_NOTES_HTTP_TIMEOUT_MS),
      retryBackoffMs: readNumber('FISCAL_NOTES_HTTP_RETRY_BACKOFF_MS', DEFAULT_FISCAL_NOTES_HTTP_RETRY_BACKOFF_MS),
      maxResponseBytes: Math.min(
        readNumber('FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES', DEFAULT_FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES),
        DEFAULT_FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES,
      ),
    },
    cache: {
      ttlSeconds: readNumber('FISCAL_NOTES_CACHE_TTL_SECONDS', DEFAULT_FISCAL_NOTES_CACHE_TTL_SECONDS),
    },
    rateLimit: {
      userPerMinute: readNumber('FISCAL_NOTES_RL_USER_PER_MINUTE', DEFAULT_FISCAL_NOTES_RL_USER_PER_MINUTE),
      userPerHour: readNumber('FISCAL_NOTES_RL_USER_PER_HOUR', DEFAULT_FISCAL_NOTES_RL_USER_PER_HOUR),
      globalPerMinute: readNumber('FISCAL_NOTES_RL_GLOBAL_PER_MINUTE', DEFAULT_FISCAL_NOTES_RL_GLOBAL_PER_MINUTE),
    },
    circuitBreaker: {
      failureThreshold: readNumber('FISCAL_NOTES_CB_FAILURE_THRESHOLD', DEFAULT_FISCAL_NOTES_CB_FAILURE_THRESHOLD),
      cooldownSeconds: readCooldownSeconds(),
    },
  };
});

export const fiscalNotesEnvSchema = {
  FISCAL_NOTES_SEFAZ_CE_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default(DEFAULT_FISCAL_NOTES_SEFAZ_CE_BASE_URL),
  FISCAL_NOTES_HTTP_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(15000)
    .default(DEFAULT_FISCAL_NOTES_HTTP_TIMEOUT_MS),
  FISCAL_NOTES_HTTP_RETRY_BACKOFF_MS: Joi.number()
    .integer()
    .min(50)
    .max(3000)
    .default(DEFAULT_FISCAL_NOTES_HTTP_RETRY_BACKOFF_MS),
  FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES: Joi.number()
    .integer()
    .min(65536)
    .max(DEFAULT_FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES)
    .default(DEFAULT_FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES),
  FISCAL_NOTES_CACHE_TTL_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(3600)
    .default(DEFAULT_FISCAL_NOTES_CACHE_TTL_SECONDS),
  FISCAL_NOTES_RL_USER_PER_MINUTE: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(DEFAULT_FISCAL_NOTES_RL_USER_PER_MINUTE),
  FISCAL_NOTES_RL_USER_PER_HOUR: Joi.number().integer().min(1).max(1000).default(DEFAULT_FISCAL_NOTES_RL_USER_PER_HOUR),
  FISCAL_NOTES_RL_GLOBAL_PER_MINUTE: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(DEFAULT_FISCAL_NOTES_RL_GLOBAL_PER_MINUTE),
  FISCAL_NOTES_CB_FAILURE_THRESHOLD: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .default(DEFAULT_FISCAL_NOTES_CB_FAILURE_THRESHOLD),
  FISCAL_NOTES_CB_COOLDOWN_SECONDS: Joi.string()
    .trim()
    .default(DEFAULT_FISCAL_NOTES_CB_COOLDOWN_SECONDS.join(','))
    .custom((value: string, helpers) => {
      if (!parseFiscalNotesCooldownSecondsCsv(value)) {
        return helpers.error('any.invalid');
      }

      return value;
    }, 'Fiscal notes circuit breaker cooldown CSV validation')
    .messages({
      'any.invalid': 'FISCAL_NOTES_CB_COOLDOWN_SECONDS must be a comma-separated list of integers >= 5',
    }),
};
