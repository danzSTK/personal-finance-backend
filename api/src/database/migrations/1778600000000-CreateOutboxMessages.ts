import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOutboxMessages1778600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "outbox_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_name" character varying(255) NOT NULL,
        "event_version" integer NOT NULL DEFAULT 1,
        "aggregate_type" character varying(100) NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "deduplication_key" character varying(255),
        "payload" jsonb NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status" character varying(30) NOT NULL DEFAULT 'PENDING',
        "attempts" integer NOT NULL DEFAULT 0,
        "max_attempts" integer NOT NULL DEFAULT 10,
        "next_retry_at" TIMESTAMP WITH TIME ZONE,
        "locked_by" character varying(100),
        "locked_until" TIMESTAMP WITH TIME ZONE,
        "last_error" text,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "published_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_outbox_messages" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_outbox_messages_status"
          CHECK ("status" IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED', 'DEAD')),
        CONSTRAINT "CHK_outbox_messages_attempts"
          CHECK ("attempts" >= 0 AND "max_attempts" > 0 AND "attempts" <= "max_attempts"),
        CONSTRAINT "CHK_outbox_messages_event_version"
          CHECK ("event_version" > 0)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_outbox_messages_deduplication_key"
      ON "outbox_messages" ("deduplication_key")
      WHERE "deduplication_key" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_outbox_messages_ready"
      ON "outbox_messages" ("status", "next_retry_at", "occurred_at")
      WHERE "status" IN ('PENDING', 'FAILED')
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_outbox_messages_expired_locks"
      ON "outbox_messages" ("locked_until")
      WHERE "status" = 'PROCESSING'
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_outbox_messages_aggregate"
      ON "outbox_messages" ("aggregate_type", "aggregate_id", "occurred_at")
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_outbox_messages_updated_at
      BEFORE UPDATE ON "outbox_messages"
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_outbox_messages_updated_at ON "outbox_messages"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_outbox_messages_aggregate"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_outbox_messages_expired_locks"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_outbox_messages_ready"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_outbox_messages_deduplication_key"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox_messages"`);
  }
}
