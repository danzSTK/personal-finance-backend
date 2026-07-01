import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailVerificationChallenges1779300000000 implements MigrationInterface {
  name = 'CreateEmailVerificationChallenges1779300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "CHK_users_status"`);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "CHK_users_status"
      CHECK ("status" IN ('PENDING_PROFILE', 'PENDING_EMAIL_VERIFICATION', 'ACTIVE', 'BLOCKED'))
    `);

    await queryRunner.query(`
      CREATE TABLE "email_verification_challenges" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "email" varchar(320) NOT NULL,
        "purpose" varchar(50) NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "consumed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_verification_challenges" PRIMARY KEY ("id"),
        CONSTRAINT "FK_email_verification_challenges_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_email_verification_challenges_purpose"
          CHECK ("purpose" IN ('EMAIL_VERIFICATION')),
        CONSTRAINT "CHK_email_verification_challenges_token_hash_length"
          CHECK (length("token_hash") = 64),
        CONSTRAINT "CHK_email_verification_challenges_expiration"
          CHECK ("expires_at" > "created_at"),
        CONSTRAINT "CHK_email_verification_challenges_consumed_after_created"
          CHECK ("consumed_at" IS NULL OR "consumed_at" >= "created_at")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_email_verification_challenges_token"
      ON "email_verification_challenges" ("purpose", "token_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_email_verification_challenges_email_purpose_created_at"
      ON "email_verification_challenges" ("email", "purpose", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_email_verification_challenges_user_purpose_created_at"
      ON "email_verification_challenges" ("user_id", "purpose", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_email_verification_challenges_unconsumed_expiration"
      ON "email_verification_challenges" ("purpose", "expires_at")
      WHERE "consumed_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_email_verification_challenges_unconsumed_expiration"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_email_verification_challenges_user_purpose_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_email_verification_challenges_email_purpose_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_email_verification_challenges_token"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_verification_challenges"`);

    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "CHK_users_status"`);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "CHK_users_status"
      CHECK ("status" IN ('PENDING_PROFILE', 'ACTIVE', 'BLOCKED'))
    `);
  }
}
