import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateAccountInitialBalanceToCents1779000000000 implements MigrationInterface {
  name = 'MigrateAccountInitialBalanceToCents1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "accounts" ADD "initial_balance_cents" bigint`);

    await queryRunner.query(`
      UPDATE "accounts"
      SET "initial_balance_cents" = ROUND("initial_balance" * 100)::bigint
    `);

    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "initial_balance_cents" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "initial_balance_cents" SET DEFAULT 0`);

    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD CONSTRAINT "CHK_accounts_initial_balance_cents"
      CHECK ("initial_balance_cents" >= 0)
    `);

    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "initial_balance"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "accounts" ADD "initial_balance" numeric(10,2)`);

    await queryRunner.query(`
      UPDATE "accounts"
      SET "initial_balance" = ("initial_balance_cents"::numeric / 100)
    `);

    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "initial_balance" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "initial_balance" SET DEFAULT 0.00`);

    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "CHK_accounts_initial_balance_cents"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "initial_balance_cents"`);
  }
}
