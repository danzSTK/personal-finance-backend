import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueCashAccountPerUser1778202300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM "accounts"
          WHERE "account_type" = 'CASH'
          GROUP BY "user_id"
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Cannot create UQ_accounts_user_cash: duplicate CASH accounts exist';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_accounts_user_cash"
      ON "accounts" ("user_id")
      WHERE "account_type" = 'CASH'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_accounts_user_cash"`);
  }
}
