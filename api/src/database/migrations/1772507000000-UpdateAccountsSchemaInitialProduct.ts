import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateAccountsSchemaInitialProduct1772507000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_accounts_user_active"`);

    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_deactivation"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_type"`);

    await queryRunner.query(`ALTER TABLE "accounts" ADD "color" character varying(20)`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD "icon" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD "include_in_total" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD "is_archived" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD "is_default" boolean NOT NULL DEFAULT false`);

    await queryRunner.query(`
      UPDATE "accounts"
      SET "account_type" = 'BANK'
      WHERE "account_type" IN ('SAVINGS', 'CHECKING')
    `);

    await queryRunner.query(`
      UPDATE "accounts"
      SET "is_archived" = NOT "is_active"
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accounts_account_type_enum') THEN
          CREATE TYPE "public"."accounts_account_type_enum" AS ENUM('CASH', 'BANK', 'CREDIT_CARD', 'INVESTMENT');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "accounts"
      ALTER COLUMN "account_type" TYPE "public"."accounts_account_type_enum"
      USING ("account_type"::text::"public"."accounts_account_type_enum")
    `);

    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "deactivated_at"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "is_active"`);

    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD CONSTRAINT "CHK_accounts_type"
      CHECK ("account_type" IN ('CASH', 'BANK', 'CREDIT_CARD', 'INVESTMENT'))
    `);

    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD CONSTRAINT "CHK_accounts_default_not_archived"
      CHECK (NOT ("is_default" = true AND "is_archived" = true))
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT "id", ROW_NUMBER() OVER (PARTITION BY "user_id" ORDER BY "created_at" ASC, "id" ASC) AS row_num
        FROM "accounts"
        WHERE "is_archived" = false
      )
      UPDATE "accounts" a
      SET "is_default" = true
      FROM ranked r
      WHERE a."id" = r."id" AND r.row_num = 1
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_accounts_user_not_archived"
      ON "accounts" ("user_id")
      WHERE "is_archived" = false
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_accounts_user_default_active"
      ON "accounts" ("user_id")
      WHERE "is_default" = true AND "is_archived" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_accounts_user_default_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_accounts_user_not_archived"`);

    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_default_not_archived"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_type"`);

    await queryRunner.query(`ALTER TABLE "accounts" ADD "is_active" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD "deactivated_at" TIMESTAMP WITH TIME ZONE`);

    await queryRunner.query(`
      UPDATE "accounts"
      SET
        "is_active" = NOT "is_archived",
        "deactivated_at" = CASE WHEN "is_archived" = true THEN NOW() ELSE NULL END
    `);

    await queryRunner.query(`
      ALTER TABLE "accounts"
      ALTER COLUMN "account_type" TYPE character varying(40)
      USING ("account_type"::text)
    `);

    await queryRunner.query(`
      UPDATE "accounts"
      SET "account_type" = 'CHECKING'
      WHERE "account_type" = 'BANK'
    `);

    await queryRunner.query(`
      UPDATE "accounts"
      SET "account_type" = 'CHECKING'
      WHERE "account_type" = 'INVESTMENT'
    `);

    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "is_default"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "is_archived"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "include_in_total"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "icon"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "color"`);

    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD CONSTRAINT "CHK_accounts_type"
      CHECK ("account_type" IN ('SAVINGS', 'CHECKING', 'CREDIT_CARD', 'CASH'))
    `);

    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD CONSTRAINT "CHK_accounts_deactivation"
      CHECK (
        ("is_active" = true AND "deactivated_at" IS NULL) OR
        ("is_active" = false AND "deactivated_at" IS NOT NULL)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_accounts_user_active"
      ON "accounts" ("user_id")
      WHERE "is_active" = true
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS "public"."accounts_account_type_enum"`);
  }
}
