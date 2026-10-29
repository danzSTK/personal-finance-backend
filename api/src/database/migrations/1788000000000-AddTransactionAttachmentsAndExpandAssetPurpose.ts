import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransactionAttachmentsAndExpandAssetPurpose1788000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "transaction_attachments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "transaction_id" uuid NOT NULL,
        "asset_id" uuid NOT NULL,
        "position" smallint NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transaction_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transaction_attachments_transaction"
          FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transaction_attachments_asset"
          FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT,
        CONSTRAINT "UQ_transaction_attachments_transaction_asset"
          UNIQUE ("transaction_id", "asset_id"),
        CONSTRAINT "UQ_transaction_attachments_transaction_position"
          UNIQUE ("transaction_id", "position"),
        CONSTRAINT "CHK_transaction_attachments_position"
          CHECK ("position" >= 0 AND "position" <= 2)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_transaction_attachments_transaction_position"
      ON "transaction_attachments" ("transaction_id", "position")
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_transaction_attachments_updated_at
      BEFORE UPDATE ON "transaction_attachments"
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at()
    `);

    await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "CHK_assets_purpose"`);
    await queryRunner.query(`
      ALTER TABLE "assets" ADD CONSTRAINT "CHK_assets_purpose"
        CHECK ("purpose" IN ('USER_AVATAR', 'TRANSACTION_ATTACHMENT'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "CHK_assets_purpose"`);
    await queryRunner.query(`
      ALTER TABLE "assets" ADD CONSTRAINT "CHK_assets_purpose"
        CHECK ("purpose" IN ('USER_AVATAR'))
    `);

    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_transaction_attachments_updated_at ON "transaction_attachments"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_transaction_attachments_transaction_position"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transaction_attachments"`);
  }
}
