import type { DomainEvent } from '@/shared/events';

export interface RehydrateEventInput {
  aggregateId: string;
  occurredAt: Date;
  metadata: Record<string, unknown>;
  payload: unknown;
}

export interface EventRehydrator {
  readonly eventName: string;
  readonly eventVersion: number;

  rehydrate(input: RehydrateEventInput): DomainEvent;
}
