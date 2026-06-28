import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailMessages1779100000000 implements MigrationInterface {
  name = 'CreateEmailMessages1779100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "email_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "type" varchar(50) NOT NULL,
        "recipient_email" varchar(320) NOT NULL,
        "recipient_name" varchar(120),
        "provider" varchar(50) NOT NULL,
        "template_key" varchar(100) NOT NULL,
        "provider_template_id" varchar(100) NOT NULL,
        "template_params" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "idempotency_key" varchar(255) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "provider_message_id" varchar(255),
        "attempts_count" integer NOT NULL DEFAULT 0,
        "last_error_code" varchar(100),
        "last_error_message" text,
        "processing_at" timestamptz,
        "sent_at" timestamptz,
        "failed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_email_messages_status" CHECK ("status" IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED_RETRYABLE', 'FAILED_PERMANENT', 'CANCELED')),
        CONSTRAINT "CHK_email_messages_attempts_count" CHECK ("attempts_count" >= 0),
        CONSTRAINT "CHK_email_messages_template_params_object" CHECK (jsonb_typeof("template_params") = 'object')
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_email_messages_idempotency_key"
      ON "email_messages" ("idempotency_key")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_email_messages_status_created_at"
      ON "email_messages" ("status", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_email_messages_recipient_email_created_at"
      ON "email_messages" ("recipient_email", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_email_messages_type_created_at"
      ON "email_messages" ("type", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_email_messages_type_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_email_messages_recipient_email_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_email_messages_status_created_at"`);
    await queryRunner.query(`DROP INDEX "UQ_email_messages_idempotency_key"`);
    await queryRunner.query(`DROP TABLE "email_messages"`);
  }
}
