import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationResendState1787616000000 implements MigrationInterface {
  name = 'AddEmailVerificationResendState1787616000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_verification_challenges" ADD "origin" varchar(30) DEFAULT 'LEGACY_UNKNOWN'`,
    );
    await queryRunner.query(`
      UPDATE "email_verification_challenges"
      SET "origin" = 'LEGACY_UNKNOWN'
    `);
    await queryRunner.query(`ALTER TABLE "email_verification_challenges" ALTER COLUMN "origin" SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "email_verification_challenges"
      ADD CONSTRAINT "CHK_email_verification_challenges_origin"
      CHECK ("origin" IN ('AUTOMATIC', 'MANUAL_RESEND', 'LEGACY_UNKNOWN'))
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_email_verification_challenges_automatic_user_purpose"
      ON "email_verification_challenges" ("user_id", "purpose")
      WHERE "origin" = 'AUTOMATIC'
    `);

    await queryRunner.query(`ALTER TABLE "email_messages" ADD "deliver_before" timestamptz`);
    await queryRunner.query(`
      ALTER TABLE "email_messages"
      ADD CONSTRAINT "CHK_email_messages_deliver_before"
      CHECK ("deliver_before" IS NULL OR "deliver_before" > "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "email_messages"
      DROP CONSTRAINT "CHK_email_messages_deliver_before"
    `);
    await queryRunner.query(`ALTER TABLE "email_messages" DROP COLUMN "deliver_before"`);

    await queryRunner.query(`DROP INDEX "UQ_email_verification_challenges_automatic_user_purpose"`);
    await queryRunner.query(`
      ALTER TABLE "email_verification_challenges"
      DROP CONSTRAINT "CHK_email_verification_challenges_origin"
    `);
    await queryRunner.query(`ALTER TABLE "email_verification_challenges" DROP COLUMN "origin"`);
  }
}
