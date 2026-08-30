import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandAccountTemplates1787979500000 implements MigrationInterface {
  name = 'ExpandAccountTemplates1787979500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "account_templates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "template_type" character varying(20) NOT NULL,
        "owner_user_id" uuid,
        "catalog_key" character varying(80),
        "name" character varying(255) NOT NULL,
        "color_token" character varying(30),
        "icon_key" character varying(50),
        "logo_storage_key" character varying(1024),
        "bank_code" smallint,
        "ispb" character varying(8),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_account_templates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_account_templates_owner_user"
          FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_account_templates_type"
          CHECK ("template_type" IN ('INSTITUTIONAL', 'CUSTOM')),
        CONSTRAINT "CHK_account_templates_owner"
          CHECK (
            ("template_type" = 'INSTITUTIONAL' AND "owner_user_id" IS NULL) OR
            ("template_type" = 'CUSTOM' AND "owner_user_id" IS NOT NULL)
          ),
        CONSTRAINT "CHK_account_templates_institutional_metadata"
          CHECK (
            (
              "template_type" = 'INSTITUTIONAL' AND
              "catalog_key" IS NOT NULL AND
              "color_token" IS NOT NULL AND
              "icon_key" IS NULL AND
              "logo_storage_key" IS NOT NULL AND
              "bank_code" IS NOT NULL AND
              "ispb" IS NOT NULL
            ) OR
            (
              "template_type" = 'CUSTOM' AND
              "catalog_key" IS NULL AND
              "logo_storage_key" IS NULL AND
              "bank_code" IS NULL AND
              "ispb" IS NULL
            )
          ),
        CONSTRAINT "CHK_account_templates_storage_key"
          CHECK (
            "logo_storage_key" IS NULL OR
            ("logo_storage_key" <> '' AND "logo_storage_key" NOT LIKE '/%')
          ),
        CONSTRAINT "CHK_account_templates_ispb"
          CHECK ("ispb" IS NULL OR "ispb" ~ '^[0-9]{8}$'),
        CONSTRAINT "CHK_account_templates_bank_code"
          CHECK ("bank_code" IS NULL OR "bank_code" BETWEEN 1 AND 999)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_account_templates_catalog_key"
      ON "account_templates" ("catalog_key")
      WHERE "catalog_key" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_account_templates_bank_code"
      ON "account_templates" ("bank_code")
      WHERE "template_type" = 'INSTITUTIONAL'
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_account_templates_ispb"
      ON "account_templates" ("ispb")
      WHERE "template_type" = 'INSTITUTIONAL'
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_account_templates_owner_user_id"
      ON "account_templates" ("owner_user_id")
      WHERE "template_type" = 'CUSTOM'
    `);

    await queryRunner.query(`
      CREATE TRIGGER "trg_account_templates_updated_at"
      BEFORE UPDATE ON "account_templates"
      FOR EACH ROW EXECUTE FUNCTION "set_updated_at"()
    `);

    await queryRunner.query(`ALTER TABLE "accounts" ADD "template_id" uuid`);

    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD CONSTRAINT "FK_accounts_template"
      FOREIGN KEY ("template_id") REFERENCES "account_templates"("id")
      ON DELETE NO ACTION
      DEFERRABLE INITIALLY DEFERRED
    `);

    await queryRunner.query(`CREATE INDEX "idx_accounts_template_id" ON "accounts" ("template_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_accounts_template_id"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "FK_accounts_template"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "template_id"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_account_templates_updated_at" ON "account_templates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "account_templates"`);
  }
}
