import { getWorkerConfigInvariantError } from './config.module';

describe('getWorkerConfigInvariantError', () => {
  const validConfig = {
    OUTBOX_LEASE_RENEW_INTERVAL_MS: 10_000,
    OUTBOX_LEASE_MS: 30_000,
    OUTBOX_CONCURRENCY: 5,
    OUTBOX_BATCH_SIZE: 25,
    WORKER_HEARTBEAT_INTERVAL_MS: 10_000,
    WORKER_HEARTBEAT_TTL_MS: 30_000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts coherent worker timing and capacity values', () => {
    expect(getWorkerConfigInvariantError(validConfig)).toBeNull();
  });

  it('rejects lease renewal that cannot happen before expiration', () => {
    expect(
      getWorkerConfigInvariantError({
        ...validConfig,
        OUTBOX_LEASE_RENEW_INTERVAL_MS: 30_000,
      }),
    ).toContain('OUTBOX_LEASE_RENEW_INTERVAL_MS');
  });

  it('rejects concurrency above the claimed batch capacity', () => {
    expect(getWorkerConfigInvariantError({ ...validConfig, OUTBOX_CONCURRENCY: 26 })).toContain('OUTBOX_CONCURRENCY');
  });

  it('rejects heartbeat intervals that reach the TTL', () => {
    expect(
      getWorkerConfigInvariantError({
        ...validConfig,
        WORKER_HEARTBEAT_INTERVAL_MS: 30_000,
      }),
    ).toContain('WORKER_HEARTBEAT_INTERVAL_MS');
  });
});
