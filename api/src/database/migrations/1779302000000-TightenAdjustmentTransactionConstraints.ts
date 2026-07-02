import { MigrationInterface, QueryRunner } from 'typeorm';

export class TightenAdjustmentTransactionConstraints1779302000000 implements MigrationInterface {
  name = 'TightenAdjustmentTransactionConstraints1779302000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_direction"`);
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_direction"
      CHECK (
        ("type" = 'ADJUSTMENT' AND "direction" IS NOT NULL AND "direction" IN ('INCREASE', 'DECREASE')) OR
        ("type" <> 'ADJUSTMENT' AND "direction" IS NULL)
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_adjustment_description"`,
    );
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_adjustment_description"
      CHECK (
        "type" <> 'ADJUSTMENT' OR
        ("description" IS NOT NULL AND length(btrim("description")) > 0)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_adjustment_description"`,
    );
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_adjustment_description"
      CHECK ("type" <> 'ADJUSTMENT' OR length(btrim("description")) > 0)
    `);

    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_direction"`);
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_direction"
      CHECK (
        ("type" = 'ADJUSTMENT' AND "direction" IN ('INCREASE', 'DECREASE')) OR
        ("type" <> 'ADJUSTMENT' AND "direction" IS NULL)
      )
    `);
  }
}
