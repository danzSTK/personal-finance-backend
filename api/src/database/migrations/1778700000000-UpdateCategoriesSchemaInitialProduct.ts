import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCategoriesSchemaInitialProduct1778700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_categories_user_name_type_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_categories_user_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_categories_user_active"`);

    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "CHK_categories_deactivation"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "CHK_categories_type"`);

    await queryRunner.query(`ALTER TABLE "categories" RENAME COLUMN "label" TO "display_name"`);

    await queryRunner.query(`ALTER TABLE "categories" ADD "color_token" character varying(30)`);
    await queryRunner.query(`ALTER TABLE "categories" ADD "icon_key" character varying(50)`);
    await queryRunner.query(`ALTER TABLE "categories" ADD "is_system" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "categories" ADD "include_in_reports" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "categories" ADD "is_archived" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "categories" ADD "archived_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "categories" ADD "sort_order" integer NOT NULL DEFAULT 0`);

    await queryRunner.query(`
      UPDATE "categories"
      SET
        "is_archived" = NOT "is_active",
        "archived_at" = "deactivated_at"
    `);

    await queryRunner.query(`
      UPDATE "categories"
      SET "archived_at" = NOW()
      WHERE "is_archived" = true AND "archived_at" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "categories"
      SET "display_name" = "name"
      WHERE length(btrim("display_name")) = 0
    `);

    await queryRunner.query(`
      UPDATE "categories"
      SET "name" = trim(both '-' from regexp_replace(
        translate(
          lower(btrim("display_name")),
          'áàâãäåéèêëíìîïóòôõöúùûüçñ',
          'aaaaaaeeeeiiiiooooouuuucn'
        ),
        '[^a-z]+',
        '-',
        'g'
      ))
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM "categories"
          WHERE "is_archived" = false
          GROUP BY "user_id", "type", "name"
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Cannot create unique active category index: duplicated normalized category names found';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "deactivated_at"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "is_active"`);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD CONSTRAINT "CHK_categories_type"
      CHECK ("type" IN ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT', 'INVESTMENT'))
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD CONSTRAINT "CHK_categories_name_normalized"
      CHECK ("name" ~ '^[a-z]+(-[a-z]+)*$')
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD CONSTRAINT "CHK_categories_display_name_not_empty"
      CHECK (length(btrim("display_name")) > 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD CONSTRAINT "CHK_categories_color_token_not_empty"
      CHECK ("color_token" IS NULL OR length(btrim("color_token")) > 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD CONSTRAINT "CHK_categories_icon_key_not_empty"
      CHECK ("icon_key" IS NULL OR length(btrim("icon_key")) > 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD CONSTRAINT "CHK_categories_sort_order"
      CHECK ("sort_order" >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD CONSTRAINT "CHK_categories_archive_state"
      CHECK (
        ("is_archived" = false AND "archived_at" IS NULL) OR
        ("is_archived" = true AND "archived_at" IS NOT NULL)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_categories_user_type_name_not_archived"
      ON "categories" ("user_id", "type", "name")
      WHERE "is_archived" = false
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_categories_user_type_not_archived"
      ON "categories" ("user_id", "type")
      WHERE "is_archived" = false
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_categories_user_not_archived"
      ON "categories" ("user_id")
      WHERE "is_archived" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_categories_user_not_archived"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_categories_user_type_not_archived"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_categories_user_type_name_not_archived"`);

    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "CHK_categories_archive_state"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "CHK_categories_sort_order"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "CHK_categories_icon_key_not_empty"`);
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "CHK_categories_color_token_not_empty"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "CHK_categories_display_name_not_empty"`,
    );
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "CHK_categories_name_normalized"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "CHK_categories_type"`);

    await queryRunner.query(`
      UPDATE "categories"
      SET "type" = 'EXPENSE'
      WHERE "type" NOT IN ('INCOME', 'EXPENSE')
    `);

    await queryRunner.query(`ALTER TABLE "categories" ADD "is_active" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "categories" ADD "deactivated_at" TIMESTAMP WITH TIME ZONE`);

    await queryRunner.query(`
      UPDATE "categories"
      SET
        "is_active" = NOT "is_archived",
        "deactivated_at" = "archived_at",
        "name" = "display_name"
    `);

    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "sort_order"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "archived_at"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "is_archived"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "include_in_reports"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "is_system"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "icon_key"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "color_token"`);

    await queryRunner.query(`ALTER TABLE "categories" RENAME COLUMN "display_name" TO "label"`);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD CONSTRAINT "CHK_categories_type"
      CHECK ("type" IN ('INCOME', 'EXPENSE'))
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD CONSTRAINT "CHK_categories_deactivation"
      CHECK (
        ("is_active" = true AND "deactivated_at" IS NULL) OR
        ("is_active" = false AND "deactivated_at" IS NOT NULL)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_categories_user_name_type_active"
      ON "categories" ("user_id", "name", "type")
      WHERE "is_active" = true
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_categories_user_type"
      ON "categories" ("user_id", "type")
      WHERE "is_active" = true
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_categories_user_active"
      ON "categories" ("user_id")
      WHERE "is_active" = true
    `);
  }
}
