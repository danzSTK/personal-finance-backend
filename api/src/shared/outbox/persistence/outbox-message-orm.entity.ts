import { OutboxMessageStatus } from '@/common/models/enums/outbox-message-status.enum';
import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('outbox_messages')
@Index('UQ_outbox_messages_deduplication_key', ['deduplicationKey'], {
  unique: true,
  where: 'deduplication_key IS NOT NULL',
})
@Index('idx_outbox_messages_ready', ['status', 'nextRetryAt', 'occurredAt'], {
  where: "status IN ('PENDING', 'FAILED')",
})
@Index('idx_outbox_messages_expired_locks', ['lockedUntil'], {
  where: "status = 'PROCESSING'",
})
@Index('idx_outbox_messages_aggregate', ['aggregateType', 'aggregateId', 'occurredAt'])
@Check('CHK_outbox_messages_status', `"status" IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED', 'DEAD')`)
@Check('CHK_outbox_messages_attempts', `"attempts" >= 0 AND "max_attempts" > 0 AND "attempts" <= "max_attempts"`)
@Check('CHK_outbox_messages_event_version', `"event_version" > 0`)
export class OutboxMessageOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_name', type: 'varchar', length: 255 })
  eventName: string;

  @Column({ name: 'event_version', type: 'integer', default: 1 })
  eventVersion: number;

  @Column({ name: 'aggregate_type', type: 'varchar', length: 100 })
  aggregateType: string;

  @Column({ name: 'aggregate_id', type: 'uuid' })
  aggregateId: string;

  @Column({ name: 'deduplication_key', type: 'varchar', length: 255, nullable: true })
  deduplicationKey: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  // TODO: Consider normalizing metadata into a separate table if it grows significantly or has a different access pattern than the main payload.
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @Column({ type: 'varchar', length: 30, default: OutboxMessageStatus.PENDING })
  status: OutboxMessageStatus;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ name: 'max_attempts', type: 'integer', default: 10 })
  maxAttempts: number;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt: Date | null;

  @Column({ name: 'locked_by', type: 'varchar', length: 100, nullable: true })
  lockedBy: string | null;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
