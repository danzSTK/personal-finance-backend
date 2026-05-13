export interface DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  readonly eventName: string;
  readonly eventVersion: number;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly deduplicationKey?: string | null;

  toPayload(): TPayload;
}
