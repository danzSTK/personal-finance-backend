import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1766306225658 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criar extensão pgcrypto
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // Criar função set_updated_at
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Criar tabela users com CHECK
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying(255),
        "name" character varying(255),
        "status" character varying(50) NOT NULL DEFAULT 'PENDING_PROFILE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_users_status" CHECK (status IN ('PENDING_PROFILE', 'ACTIVE', 'BLOCKED'))
      )
    `);

    // Criar índices users
    await queryRunner.query(`CREATE INDEX "idx_users_status" ON "users" ("status")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_users_email" ON "users" ("email") WHERE email IS NOT NULL`);

    // Trigger users
    await queryRunner.query(`
      CREATE TRIGGER trg_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at()
    `);

    // Criar tabela auth_providers
    await queryRunner.query(`
      CREATE TABLE "auth_providers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "provider" character varying(100) NOT NULL,
        "provider_user_id" character varying(255) NOT NULL,
        "password_hash" character varying(255),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_providers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_auth_providers" UNIQUE ("provider", "provider_user_id"),
        CONSTRAINT "FK_auth_providers_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_auth_providers_user_id" ON "auth_providers" ("user_id")`);

    await queryRunner.query(`
      CREATE TRIGGER trg_auth_providers_updated_at
      BEFORE UPDATE ON auth_providers
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at()
    `);

    // Criar tabela accounts com CHECKs
    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "account_type" character varying(40) NOT NULL,
        "name" character varying(255) NOT NULL,
        "initial_balance" numeric(10,2) NOT NULL DEFAULT 0.00,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "is_active" boolean NOT NULL DEFAULT true,
        "deactivated_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_accounts_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_accounts_type" CHECK (account_type IN ('SAVINGS', 'CHECKING', 'CREDIT_CARD', 'CASH')),
        CONSTRAINT "CHK_accounts_deactivation" CHECK (
          (is_active = true AND deactivated_at IS NULL) OR
          (is_active = false AND deactivated_at IS NOT NULL)
        )
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_accounts_user_id" ON "accounts" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_accounts_user_active" ON "accounts" ("user_id") WHERE is_active = true`);

    await queryRunner.query(`
      CREATE TRIGGER trg_accounts_updated_at
      BEFORE UPDATE ON accounts
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at()
    `);

    // Criar tabela categories com CHECKs
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "label" character varying(255) NOT NULL,
        "description" text,
        "type" character varying(20) NOT NULL,
        "icon" character varying(100),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "is_active" boolean NOT NULL DEFAULT true,
        "deactivated_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_categories" PRIMARY KEY ("id"),
        CONSTRAINT "FK_categories_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_categories_type" CHECK (type IN ('INCOME', 'EXPENSE')),
        CONSTRAINT "CHK_categories_deactivation" CHECK (
          (is_active = true AND deactivated_at IS NULL) OR
          (is_active = false AND deactivated_at IS NOT NULL)
        )
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_categories_user_name_type_active" ON "categories" ("user_id", "name", "type") WHERE is_active = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_categories_user_type" ON "categories" ("user_id", "type") WHERE is_active = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_categories_user_active" ON "categories" ("user_id") WHERE is_active = true`,
    );

    await queryRunner.query(`
      CREATE TRIGGER trg_categories_updated_at
      BEFORE UPDATE ON categories
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at()
    `);

    // Criar tabela transactions com CHECKs
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "account_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "date" date NOT NULL DEFAULT NOW(),
        "description" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "is_active" boolean NOT NULL DEFAULT true,
        "deactivated_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transactions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transactions_account" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transactions_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION,
        CONSTRAINT "CHK_transactions_amount" CHECK (amount > 0),
        CONSTRAINT "CHK_transactions_deactivation" CHECK (
          (is_active = true AND deactivated_at IS NULL) OR
          (is_active = false AND deactivated_at IS NOT NULL)
        )
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_transactions_user_date_id" ON "transactions" ("user_id", "date" DESC, "id" DESC) WHERE is_active = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_transactions_user" ON "transactions" ("user_id") WHERE is_active = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_transactions_account" ON "transactions" ("account_id") WHERE is_active = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_transactions_category" ON "transactions" ("category_id") WHERE is_active = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_transactions_user_date" ON "transactions" ("user_id", "date") WHERE is_active = true`,
    );

    await queryRunner.query(`
      CREATE TRIGGER trg_transactions_updated_at
      BEFORE UPDATE ON transactions
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "transactions" CASCADE`);
    await queryRunner.query(`DROP TABLE "categories" CASCADE`);
    await queryRunner.query(`DROP TABLE "accounts" CASCADE`);
    await queryRunner.query(`DROP TABLE "auth_providers" CASCADE`);
    await queryRunner.query(`DROP TABLE "users" CASCADE`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_updated_at()`);
  }
}
