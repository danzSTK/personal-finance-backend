import { OutboxMessageStatus } from '@/common/models/enums';
import { OutboxMessageOrmEntity } from '@/shared/outbox/outbox-message-orm.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

export interface CreateOutboxMessageInput {
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

export interface ClaimReadyOutboxMessagesOptions {
  limit: number;
  lockedBy: string;
  lockForMs: number;
}

@Injectable()
export class OutboxMessageRepository {
  constructor(
    @InjectRepository(OutboxMessageOrmEntity)
    private readonly repository: Repository<OutboxMessageOrmEntity>,
  ) {}

  async saveAll(messages: CreateOutboxMessageInput[], options: { manager: EntityManager }): Promise<void> {
    if (messages.length === 0) {
      return;
    }

    const repository = options.manager.getRepository(OutboxMessageOrmEntity);
    const entities = repository.create(messages);

    await repository.save(entities);
  }

  async claimReadyBatch(options: ClaimReadyOutboxMessagesOptions): Promise<OutboxMessageOrmEntity[]> {
    return await this.repository.manager.transaction(async manager => {
      return await manager.query<OutboxMessageOrmEntity[]>(
        `
          WITH picked AS (
            SELECT "id"
            FROM "outbox_messages"
            WHERE
              (
                "status" = $1
                OR ("status" = $2 AND ("next_retry_at" IS NULL OR "next_retry_at" <= NOW()))
                OR ("status" = $3 AND "locked_until" <= NOW())
              )
              AND "attempts" < "max_attempts"
            ORDER BY "occurred_at" ASC, "created_at" ASC
            LIMIT $4
            FOR UPDATE SKIP LOCKED
          )
          UPDATE "outbox_messages" AS outbox
          SET
            "status" = $3,
            "locked_by" = $5,
            "locked_until" = NOW() + ($6 * INTERVAL '1 millisecond'),
            "attempts" = outbox."attempts" + 1,
            "updated_at" = NOW()
          FROM picked
          WHERE outbox."id" = picked."id"
          RETURNING
            outbox."id" AS "id",
            outbox."event_name" AS "eventName",
            outbox."event_version" AS "eventVersion",
            outbox."aggregate_type" AS "aggregateType",
            outbox."aggregate_id" AS "aggregateId",
            outbox."deduplication_key" AS "deduplicationKey",
            outbox."payload" AS "payload",
            outbox."metadata" AS "metadata",
            outbox."status" AS "status",
            outbox."attempts" AS "attempts",
            outbox."max_attempts" AS "maxAttempts",
            outbox."next_retry_at" AS "nextRetryAt",
            outbox."locked_by" AS "lockedBy",
            outbox."locked_until" AS "lockedUntil",
            outbox."last_error" AS "lastError",
            outbox."occurred_at" AS "occurredAt",
            outbox."published_at" AS "publishedAt",
            outbox."created_at" AS "createdAt",
            outbox."updated_at" AS "updatedAt"
        `,
        [
          OutboxMessageStatus.PENDING,
          OutboxMessageStatus.FAILED,
          OutboxMessageStatus.PROCESSING,
          options.limit,
          options.lockedBy,
          options.lockForMs,
        ],
      );
    });
  }

  async markPublished(id: string): Promise<void> {
    await this.repository.update(id, {
      status: OutboxMessageStatus.PUBLISHED,
      lockedBy: null,
      lockedUntil: null,
      lastError: null,
      publishedAt: new Date(),
    });
  }

  async markFailed(message: OutboxMessageOrmEntity, error: unknown, nextRetryAt: Date): Promise<void> {
    const status = message.attempts >= message.maxAttempts ? OutboxMessageStatus.DEAD : OutboxMessageStatus.FAILED;

    await this.repository.update(message.id, {
      status,
      lockedBy: null,
      lockedUntil: null,
      lastError: this.serializeError(error),
      nextRetryAt: status === OutboxMessageStatus.DEAD ? null : nextRetryAt,
    });
  }

  private serializeError(error: unknown): string {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }

    return String(error);
  }
}
