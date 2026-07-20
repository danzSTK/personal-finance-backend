import { registerAs } from '@nestjs/config';

const readNumber = (key: string, defaultValue: number): number => {
  const rawValue = process.env[key];
  return rawValue === undefined ? defaultValue : Number(rawValue);
};

export interface WorkerConfig {
  outbox: {
    pollIntervalMs: number;
    batchSize: number;
    concurrency: number;
    leaseMs: number;
    leaseRenewIntervalMs: number;
  };
  emailReconciliation: {
    intervalMs: number;
    batchSize: number;
    staleAfterMs: number;
  };
  shutdownTimeoutMs: number;
  heartbeat: {
    intervalMs: number;
    ttlMs: number;
  };
}

export default registerAs(
  'worker',
  (): WorkerConfig => ({
    outbox: {
      pollIntervalMs: readNumber('OUTBOX_POLL_INTERVAL_MS', 1_000),
      batchSize: readNumber('OUTBOX_BATCH_SIZE', 25),
      concurrency: readNumber('OUTBOX_CONCURRENCY', 5),
      leaseMs: readNumber('OUTBOX_LEASE_MS', 30_000),
      leaseRenewIntervalMs: readNumber('OUTBOX_LEASE_RENEW_INTERVAL_MS', 10_000),
    },
    emailReconciliation: {
      intervalMs: readNumber('EMAIL_ENQUEUE_RECONCILE_INTERVAL_MS', 30_000),
      batchSize: readNumber('EMAIL_ENQUEUE_RECONCILE_BATCH_SIZE', 100),
      staleAfterMs: readNumber('EMAIL_ENQUEUE_STALE_AFTER_MS', 30_000),
    },
    shutdownTimeoutMs: readNumber('WORKER_SHUTDOWN_TIMEOUT_MS', 30_000),
    heartbeat: {
      intervalMs: readNumber('WORKER_HEARTBEAT_INTERVAL_MS', 10_000),
      ttlMs: readNumber('WORKER_HEARTBEAT_TTL_MS', 30_000),
    },
  }),
);
