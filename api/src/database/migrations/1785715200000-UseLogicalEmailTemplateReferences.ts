import { MigrationInterface, QueryRunner } from 'typeorm';

export class UseLogicalEmailTemplateReferences1785715200000 implements MigrationInterface {
  name = 'UseLogicalEmailTemplateReferences1785715200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`LOCK TABLE "email_messages" IN ACCESS EXCLUSIVE MODE`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM "email_messages"
          WHERE "template_key" NOT IN ('welcome-email', 'email-verification')
        ) THEN
          RAISE EXCEPTION 'Cannot migrate email_messages with unknown template keys';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM "email_messages"
          WHERE "status" IN ('PENDING', 'PROCESSING', 'FAILED_RETRYABLE')
        ) THEN
          RAISE EXCEPTION 'Cannot migrate email_messages while reenqueuable messages exist';
        END IF;
      END
      $$
    `);
    await queryRunner.query(`ALTER TABLE "email_messages" ADD "template_version" integer`);
    await queryRunner.query(`UPDATE "email_messages" SET "template_version" = 1`);
    await queryRunner.query(`ALTER TABLE "email_messages" ALTER COLUMN "template_version" SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "email_messages"
      ADD CONSTRAINT "CHK_email_messages_template_version"
      CHECK ("template_version" >= 1)
    `);
    await queryRunner.query(`ALTER TABLE "email_messages" ALTER COLUMN "provider" DROP NOT NULL`);
    await queryRunner.query(`UPDATE "email_messages" SET "provider" = NULL WHERE "status" <> 'SENT'`);
    await queryRunner.query(`ALTER TABLE "email_messages" DROP COLUMN "provider_template_id"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "email_messages" ADD "provider_template_id" varchar(100)`);
    await queryRunner.query(`
      UPDATE "email_messages"
      SET "provider_template_id" = CASE "template_key"
        WHEN 'welcome-email' THEN '2'
        WHEN 'email-verification' THEN '3'
      END
    `);
    await queryRunner.query(`ALTER TABLE "email_messages" ALTER COLUMN "provider_template_id" SET NOT NULL`);
    await queryRunner.query(`UPDATE "email_messages" SET "provider" = COALESCE("provider", 'brevo')`);
    await queryRunner.query(`ALTER TABLE "email_messages" ALTER COLUMN "provider" SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "email_messages"
      DROP CONSTRAINT "CHK_email_messages_template_version"
    `);
    await queryRunner.query(`ALTER TABLE "email_messages" DROP COLUMN "template_version"`);
  }
}
