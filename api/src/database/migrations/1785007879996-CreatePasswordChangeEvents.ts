import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePasswordChangeEvents1785007879996 implements MigrationInterface {
  name = 'CreatePasswordChangeEvents1785007879996';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "password_change_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "auth_provider_id" uuid,
        "event_type" varchar(50) NOT NULL,
        "blocked_until" timestamptz,
        "session_id" uuid,
        "ip_address" inet,
        "user_agent" varchar(512),
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "occurred_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_password_change_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_password_change_events_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_password_change_events_provider"
          FOREIGN KEY ("auth_provider_id") REFERENCES "auth_providers"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_password_change_events_type"
          CHECK (
            "event_type" IN (
              'CURRENT_PASSWORD_FAILED',
              'PASSWORD_CHANGED',
              'FAILED_ATTEMPTS_BLOCK_STARTED'
            )
          ),
        CONSTRAINT "CHK_password_change_events_block"
          CHECK (
            (
              "event_type" = 'FAILED_ATTEMPTS_BLOCK_STARTED'
              AND "blocked_until" IS NOT NULL
              AND "blocked_until" > "occurred_at"
            )
            OR
            (
              "event_type" <> 'FAILED_ATTEMPTS_BLOCK_STARTED'
              AND "blocked_until" IS NULL
            )
          ),
        CONSTRAINT "CHK_password_change_events_metadata"
          CHECK (jsonb_typeof("metadata") = 'object')
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_password_change_events_user_type_occurred_at"
      ON "password_change_events" ("user_id", "event_type", "occurred_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_password_change_events_auth_provider_id"
      ON "password_change_events" ("auth_provider_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_password_change_events_auth_provider_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_password_change_events_user_type_occurred_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "password_change_events"`);
  }
}
