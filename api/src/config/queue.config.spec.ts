import queueConfig from './queue.config';

describe('queueConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('redis connection', () => {
    it('uses REDIS values as fallback for BullMQ connection', () => {
      process.env.REDIS_HOST = 'redis';
      process.env.REDIS_PORT = '6379';
      process.env.REDIS_PASSWORD = 'secret';
      delete process.env.BULLMQ_REDIS_HOST;
      delete process.env.BULLMQ_REDIS_PORT;
      delete process.env.BULLMQ_REDIS_PASSWORD;

      const config = queueConfig();

      expect(config.redis).toEqual({
        host: 'redis',
        port: 6379,
        password: 'secret',
        db: 1,
      });
    });

    it('prefers explicit BullMQ connection values', () => {
      process.env.REDIS_HOST = 'redis';
      process.env.REDIS_PORT = '6379';
      process.env.REDIS_PASSWORD = 'secret';
      process.env.BULLMQ_REDIS_HOST = 'queue-redis';
      process.env.BULLMQ_REDIS_PORT = '6380';
      process.env.BULLMQ_REDIS_PASSWORD = 'queue-secret';
      process.env.BULLMQ_REDIS_DB = '2';

      const config = queueConfig();

      expect(config.redis).toEqual({
        host: 'queue-redis',
        port: 6380,
        password: 'queue-secret',
        db: 2,
      });
    });

    it('treats an explicit empty BullMQ password as no password', () => {
      process.env.REDIS_PASSWORD = 'secret';
      process.env.BULLMQ_REDIS_PASSWORD = '';

      const config = queueConfig();

      expect(config.redis.password).toBeUndefined();
    });
  });

  describe('job defaults', () => {
    it('uses platform defaults when BullMQ options are not provided', () => {
      delete process.env.BULLMQ_PREFIX;
      delete process.env.BULLMQ_DEFAULT_ATTEMPTS;
      delete process.env.BULLMQ_BACKOFF_TYPE;
      delete process.env.BULLMQ_BACKOFF_DELAY_MS;
      delete process.env.BULLMQ_REMOVE_ON_COMPLETE;
      delete process.env.BULLMQ_REMOVE_ON_FAIL;
      delete process.env.BULLMQ_WORKERS_ENABLED;
      delete process.env.BULLMQ_DEFAULT_CONCURRENCY;

      const config = queueConfig();

      expect(config.prefix).toBe('personal-finance');
      expect(config.defaultJobOptions).toEqual({
        attempts: 5,
        backoffType: 'exponential',
        backoffDelayMs: 5000,
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
      expect(config.workers).toEqual({
        enabled: true,
        defaultConcurrency: 5,
      });
    });

    it('reads worker and retry options from BullMQ environment values', () => {
      process.env.BULLMQ_PREFIX = 'finance-test';
      process.env.BULLMQ_DEFAULT_ATTEMPTS = '3';
      process.env.BULLMQ_BACKOFF_TYPE = 'fixed';
      process.env.BULLMQ_BACKOFF_DELAY_MS = '2500';
      process.env.BULLMQ_REMOVE_ON_COMPLETE = '10';
      process.env.BULLMQ_REMOVE_ON_FAIL = '20';
      process.env.BULLMQ_WORKERS_ENABLED = 'false';
      process.env.BULLMQ_DEFAULT_CONCURRENCY = '2';

      const config = queueConfig();

      expect(config.prefix).toBe('finance-test');
      expect(config.defaultJobOptions).toEqual({
        attempts: 3,
        backoffType: 'fixed',
        backoffDelayMs: 2500,
        removeOnComplete: 10,
        removeOnFail: 20,
      });
      expect(config.workers).toEqual({
        enabled: false,
        defaultConcurrency: 2,
      });
    });
  });
});
