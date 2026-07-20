import queueConfig from '@/config/queue.config';
import type { ConfigType } from '@nestjs/config';
import { getWorkerHeartbeatKey, getWorkerInstanceId } from './worker-instance';

describe('worker instance', () => {
  const originalWorkerInstanceId = process.env.WORKER_INSTANCE_ID;

  afterEach(() => {
    if (originalWorkerInstanceId === undefined) {
      delete process.env.WORKER_INSTANCE_ID;
    } else {
      process.env.WORKER_INSTANCE_ID = originalWorkerInstanceId;
    }
  });

  it('uses the explicit worker instance id when configured', () => {
    process.env.WORKER_INSTANCE_ID = 'worker-2';

    expect(getWorkerInstanceId()).toBe('worker-2');
  });

  it('falls back to a non-empty host identifier', () => {
    delete process.env.WORKER_INSTANCE_ID;

    expect(getWorkerInstanceId()).not.toHaveLength(0);
  });

  it('namespaces the heartbeat by queue prefix and worker instance', () => {
    process.env.WORKER_INSTANCE_ID = 'worker-2';
    const config = { prefix: 'danfy-test' } as ConfigType<typeof queueConfig>;

    expect(getWorkerHeartbeatKey(config)).toBe('danfy-test:worker:heartbeat:worker-2');
  });
});
