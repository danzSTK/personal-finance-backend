export const QueueDefaults = {
  prefix: 'personal-finance',
  redisDb: 1,
  attempts: 5,
  backoffType: 'exponential',
  backoffDelayMs: 5_000,
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
  defaultConcurrency: 5,
} as const;

export type QueueBackoffType = 'fixed' | 'exponential';
