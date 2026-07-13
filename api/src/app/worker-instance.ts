import queueConfig from '@/config/queue.config';
import type { ConfigType } from '@nestjs/config';
import { hostname } from 'node:os';

export const getWorkerInstanceId = (): string => process.env.WORKER_INSTANCE_ID ?? hostname();

export const getWorkerHeartbeatKey = (config: ConfigType<typeof queueConfig>): string => {
  return `${config.prefix}:worker:heartbeat:${getWorkerInstanceId()}`;
};
