import { QueueBackoffType, QueueDefaults } from '@/shared/jobs/constants/queue.constants';
import { registerAs } from '@nestjs/config';

export interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  prefix: string;
  defaultJobOptions: {
    attempts: number;
    backoffType: QueueBackoffType;
    backoffDelayMs: number;
    removeOnComplete: number;
    removeOnFail: number;
  };
  workers: {
    defaultConcurrency: number;
  };
}

const hasEnv = (key: string): boolean => key in process.env;

const readString = (key: string, fallbackKey: string, defaultValue: string): string => {
  return process.env[key] ?? process.env[fallbackKey] ?? defaultValue;
};

const readOptionalString = (key: string, fallbackKey: string): string | undefined => {
  const value = hasEnv(key) ? process.env[key] : process.env[fallbackKey];

  return value && value.length > 0 ? value : undefined;
};

const readNumber = (key: string, fallbackKey: string | null, defaultValue: number): number => {
  const rawValue = process.env[key] ?? (fallbackKey ? process.env[fallbackKey] : undefined);

  return rawValue === undefined ? defaultValue : Number(rawValue);
};

const readBackoffType = (): QueueBackoffType => {
  const rawValue = process.env.BULLMQ_BACKOFF_TYPE ?? QueueDefaults.backoffType;

  return rawValue === 'fixed' ? 'fixed' : 'exponential';
};

export default registerAs(
  'queue',
  (): QueueConfig => ({
    redis: {
      host: readString('BULLMQ_REDIS_HOST', 'REDIS_HOST', 'localhost'),
      port: readNumber('BULLMQ_REDIS_PORT', 'REDIS_PORT', 6379),
      password: readOptionalString('BULLMQ_REDIS_PASSWORD', 'REDIS_PASSWORD'),
      db: readNumber('BULLMQ_REDIS_DB', null, QueueDefaults.redisDb),
    },
    prefix: process.env.BULLMQ_PREFIX ?? QueueDefaults.prefix,
    defaultJobOptions: {
      attempts: readNumber('BULLMQ_DEFAULT_ATTEMPTS', null, QueueDefaults.attempts),
      backoffType: readBackoffType(),
      backoffDelayMs: readNumber('BULLMQ_BACKOFF_DELAY_MS', null, QueueDefaults.backoffDelayMs),
      removeOnComplete: readNumber('BULLMQ_REMOVE_ON_COMPLETE', null, QueueDefaults.removeOnComplete),
      removeOnFail: readNumber('BULLMQ_REMOVE_ON_FAIL', null, QueueDefaults.removeOnFail),
    },
    workers: {
      defaultConcurrency: readNumber('BULLMQ_DEFAULT_CONCURRENCY', null, QueueDefaults.defaultConcurrency),
    },
  }),
);
