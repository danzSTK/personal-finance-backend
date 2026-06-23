import { OutboxMessageStatus } from '@/common/models/enums';

export interface CreateOutboxEventInput {
  eventName: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  deduplicationKey: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  status: OutboxMessageStatus;
  occurredAt: Date;
}
