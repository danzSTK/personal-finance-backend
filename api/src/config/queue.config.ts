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

const readRequiredString = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
};

const readOptionalString = (key: string): string | undefined => {
  const value = process.env[key];

  return value && value.length > 0 ? value : undefined;
};

const readNumber = (key: string, defaultValue: number): number => {
  const rawValue = process.env[key];

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
      host: readRequiredString('BULLMQ_REDIS_HOST'),
      port: readNumber('BULLMQ_REDIS_PORT', 6379),
      password: readOptionalString('BULLMQ_REDIS_PASSWORD'),
      db: readNumber('BULLMQ_REDIS_DB', QueueDefaults.redisDb),
    },
    prefix: process.env.BULLMQ_PREFIX ?? QueueDefaults.prefix,
    defaultJobOptions: {
      attempts: readNumber('BULLMQ_DEFAULT_ATTEMPTS', QueueDefaults.attempts),
      backoffType: readBackoffType(),
      backoffDelayMs: readNumber('BULLMQ_BACKOFF_DELAY_MS', QueueDefaults.backoffDelayMs),
      removeOnComplete: readNumber('BULLMQ_REMOVE_ON_COMPLETE', QueueDefaults.removeOnComplete),
      removeOnFail: readNumber('BULLMQ_REMOVE_ON_FAIL', QueueDefaults.removeOnFail),
    },
    workers: {
      defaultConcurrency: readNumber('BULLMQ_DEFAULT_CONCURRENCY', QueueDefaults.defaultConcurrency),
    },
  }),
);
