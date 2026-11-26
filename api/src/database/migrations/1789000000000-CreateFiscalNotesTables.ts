import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFiscalNotesTables1789000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "fiscal_notes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "transaction_id" uuid NOT NULL,
        "access_key" char(44) NOT NULL,
        "source_uf" char(2) NOT NULL,
        "number" character varying(20) NOT NULL,
        "series" character varying(10) NOT NULL,
        "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "protocol" character varying(64),
        "issuer_name" character varying(255) NOT NULL,
        "issuer_cnpj" char(14) NOT NULL,
        "issuer_address" text,
        "gross_amount_cents" bigint NOT NULL,
        "discount_amount_cents" bigint NOT NULL DEFAULT 0,
        "payable_amount_cents" bigint NOT NULL,
        "tax_amount_cents" bigint NOT NULL DEFAULT 0,
        "change_amount_cents" bigint,
        "xml_version" character varying(16),
        "xslt_version" character varying(16),
        "parser_version" character varying(32) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_fiscal_notes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_fiscal_notes_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_fiscal_notes_transaction"
          FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_fiscal_notes_access_key_digits"
          CHECK ("access_key" ~ '^[0-9]{44}$'),
        CONSTRAINT "CHK_fiscal_notes_source_uf_digits"
          CHECK ("source_uf" ~ '^[0-9]{2}$'),
        CONSTRAINT "CHK_fiscal_notes_issuer_cnpj_digits"
          CHECK ("issuer_cnpj" ~ '^[0-9]{14}$'),
        CONSTRAINT "CHK_fiscal_notes_gross_amount_cents"
          CHECK ("gross_amount_cents" >= 0),
        CONSTRAINT "CHK_fiscal_notes_discount_amount_cents"
          CHECK ("discount_amount_cents" >= 0),
        CONSTRAINT "CHK_fiscal_notes_payable_amount_cents"
          CHECK ("payable_amount_cents" >= 0),
        CONSTRAINT "CHK_fiscal_notes_tax_amount_cents"
          CHECK ("tax_amount_cents" >= 0),
        CONSTRAINT "CHK_fiscal_notes_change_amount_cents"
          CHECK ("change_amount_cents" IS NULL OR "change_amount_cents" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_fiscal_notes_user_access_key_active"
      ON "fiscal_notes" ("user_id", "access_key")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_fiscal_notes_transaction_active"
      ON "fiscal_notes" ("transaction_id")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_fiscal_notes_user_active"
      ON "fiscal_notes" ("user_id")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_fiscal_notes_transaction_id"
      ON "fiscal_notes" ("transaction_id")
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_fiscal_notes_updated_at
      BEFORE UPDATE ON "fiscal_notes"
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at()
    `);

    await queryRunner.query(`
      CREATE TABLE "fiscal_note_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "fiscal_note_id" uuid NOT NULL,
        "position" integer NOT NULL,
        "raw_description" character varying(500) NOT NULL,
        "store_code" character varying(64),
        "unit" character varying(20) NOT NULL,
        "quantity" numeric(12, 4) NOT NULL,
        "unit_price" numeric(12, 4) NOT NULL,
        "total_price_cents" bigint NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fiscal_note_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_fiscal_note_items_fiscal_note"
          FOREIGN KEY ("fiscal_note_id") REFERENCES "fiscal_notes"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_fiscal_note_items_fiscal_note_position"
          UNIQUE ("fiscal_note_id", "position"),
        CONSTRAINT "CHK_fiscal_note_items_position"
          CHECK ("position" >= 1),
        CONSTRAINT "CHK_fiscal_note_items_quantity"
          CHECK ("quantity" > 0),
        CONSTRAINT "CHK_fiscal_note_items_unit_price"
          CHECK ("unit_price" >= 0),
        CONSTRAINT "CHK_fiscal_note_items_total_price_cents"
          CHECK ("total_price_cents" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "fiscal_note_payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "fiscal_note_id" uuid NOT NULL,
        "position" integer NOT NULL,
        "method_label" character varying(120) NOT NULL,
        "amount_cents" bigint NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fiscal_note_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_fiscal_note_payments_fiscal_note"
          FOREIGN KEY ("fiscal_note_id") REFERENCES "fiscal_notes"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_fiscal_note_payments_fiscal_note_position"
          UNIQUE ("fiscal_note_id", "position"),
        CONSTRAINT "CHK_fiscal_note_payments_position"
          CHECK ("position" >= 1),
        CONSTRAINT "CHK_fiscal_note_payments_amount_cents"
          CHECK ("amount_cents" >= 0)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "fiscal_note_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fiscal_note_items"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_fiscal_notes_updated_at ON "fiscal_notes"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_fiscal_notes_transaction_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_fiscal_notes_user_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_fiscal_notes_transaction_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_fiscal_notes_user_access_key_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fiscal_notes"`);
  }
}
