import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateTransactionsSchemaInitialProduct1778900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_transactions_user_date_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_transactions_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_transactions_account"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_transactions_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_transactions_user_date"`);

    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_deactivation"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_amount"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_category"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_account"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_user"`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM "transactions" t
          JOIN "categories" c ON c."id" = t."category_id"
          WHERE c."type" NOT IN ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT')
        ) THEN
          RAISE EXCEPTION 'Cannot infer transaction type from categories outside INCOME, EXPENSE, TRANSFER, ADJUSTMENT';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM "transactions" t
          JOIN "categories" c ON c."id" = t."category_id"
          WHERE c."type" = 'TRANSFER'
        ) THEN
          RAISE EXCEPTION 'Cannot migrate legacy TRANSFER transactions without destination account';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM "transactions" t
          JOIN "categories" c ON c."id" = t."category_id"
          WHERE c."type" = 'ADJUSTMENT'
        ) THEN
          RAISE EXCEPTION 'Cannot migrate legacy ADJUSTMENT transactions without direction';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`ALTER TABLE "transactions" ADD "destination_account_id" uuid`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "type" character varying(20)`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "status" character varying(20)`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "amount_cents" bigint`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "effective_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "direction" character varying(20)`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);

    await queryRunner.query(`
      UPDATE "transactions" t
      SET
        "type" = c."type",
        "status" = 'EFFECTIVE',
        "amount_cents" = ROUND(t."amount" * 100)::bigint,
        "effective_at" = COALESCE(t."created_at", NOW()),
        "deleted_at" = CASE WHEN t."is_active" = true THEN NULL ELSE t."deactivated_at" END
      FROM "categories" c
      WHERE c."id" = t."category_id"
    `);

    await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "type" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "status" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "amount_cents" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "date" SET DEFAULT CURRENT_DATE`);

    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "amount"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "is_active"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "deactivated_at"`);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_type"
      CHECK ("type" IN ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT'))
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_status"
      CHECK ("status" IN ('PENDING', 'EFFECTIVE'))
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_amount_cents"
      CHECK ("amount_cents" > 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_effective_at_status"
      CHECK (
        ("status" = 'PENDING' AND "effective_at" IS NULL) OR
        ("status" = 'EFFECTIVE' AND "effective_at" IS NOT NULL)
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_transfer_destination"
      CHECK (
        ("type" = 'TRANSFER' AND "destination_account_id" IS NOT NULL AND "destination_account_id" <> "account_id") OR
        ("type" <> 'TRANSFER' AND "destination_account_id" IS NULL)
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_direction"
      CHECK (
        ("type" = 'ADJUSTMENT' AND "direction" IN ('INCREASE', 'DECREASE')) OR
        ("type" <> 'ADJUSTMENT' AND "direction" IS NULL)
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_adjustment_description"
      CHECK ("type" <> 'ADJUSTMENT' OR length(btrim("description")) > 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_transfer_not_deleted"
      CHECK ("type" <> 'TRANSFER' OR "deleted_at" IS NULL)
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_account"
      FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_destination_account"
      FOREIGN KEY ("destination_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_category"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_transactions_user_date_id"
      ON "transactions" ("user_id", "date" DESC, "id" DESC)
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_transactions_user_status_date"
      ON "transactions" ("user_id", "status", "date" DESC, "id" DESC)
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_transactions_account_effective"
      ON "transactions" ("user_id", "account_id", "date")
      WHERE "deleted_at" IS NULL AND "status" = 'EFFECTIVE'
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_transactions_destination_account_effective"
      ON "transactions" ("user_id", "destination_account_id", "date")
      WHERE "deleted_at" IS NULL AND "status" = 'EFFECTIVE' AND "destination_account_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_transactions_category_date"
      ON "transactions" ("user_id", "category_id", "date" DESC)
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_transactions_category_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_transactions_destination_account_effective"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_transactions_account_effective"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_transactions_user_status_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_transactions_user_date_id"`);

    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_category"`);
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_destination_account"`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_account"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_user"`);
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_transfer_not_deleted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_adjustment_description"`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_direction"`);
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_transfer_destination"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_effective_at_status"`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_amount_cents"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_status"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_type"`);

    await queryRunner.query(`ALTER TABLE "transactions" ADD "amount" numeric(10,2)`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "is_active" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "deactivated_at" TIMESTAMP WITH TIME ZONE`);

    await queryRunner.query(`
      UPDATE "transactions"
      SET
        "amount" = ("amount_cents"::numeric / 100),
        "is_active" = "deleted_at" IS NULL,
        "deactivated_at" = "deleted_at"
    `);

    await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "amount" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "date" SET DEFAULT NOW()`);

    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "direction"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "effective_at"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "amount_cents"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "status"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "type"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "destination_account_id"`);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_amount"
      CHECK ("amount" > 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_deactivation"
      CHECK (
        ("is_active" = true AND "deactivated_at" IS NULL) OR
        ("is_active" = false AND "deactivated_at" IS NOT NULL)
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_account"
      FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_category"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_transactions_user_date_id"
      ON "transactions" ("user_id", "date" DESC, "id" DESC)
      WHERE "is_active" = true
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_transactions_user"
      ON "transactions" ("user_id")
      WHERE "is_active" = true
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_transactions_account"
      ON "transactions" ("account_id")
      WHERE "is_active" = true
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_transactions_category"
      ON "transactions" ("category_id")
      WHERE "is_active" = true
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_transactions_user_date"
      ON "transactions" ("user_id", "date")
      WHERE "is_active" = true
    `);
  }
}
