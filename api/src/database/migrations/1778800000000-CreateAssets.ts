import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssets1778800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "purpose" character varying(50) NOT NULL,
        "status" character varying(30) NOT NULL DEFAULT 'PENDING_UPLOAD',
        "bucket" character varying(63) NOT NULL,
        "storage_key" character varying(1024) NOT NULL,
        "content_type" character varying(255),
        "size_bytes" bigint,
        "checksum" character varying(64),
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "failure_code" character varying(100),
        "ready_at" TIMESTAMP WITH TIME ZONE,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_assets_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_assets_purpose"
          CHECK ("purpose" IN ('USER_AVATAR')),
        CONSTRAINT "CHK_assets_status"
          CHECK ("status" IN ('PENDING_UPLOAD', 'READY', 'DELETE_PENDING', 'DELETED', 'FAILED')),
        CONSTRAINT "CHK_assets_bucket_not_empty"
          CHECK (length(btrim("bucket")) > 0),
        CONSTRAINT "CHK_assets_storage_key"
          CHECK (length(btrim("storage_key")) > 0 AND left("storage_key", 1) <> '/'),
        CONSTRAINT "CHK_assets_size_bytes"
          CHECK ("size_bytes" IS NULL OR "size_bytes" >= 0),
        CONSTRAINT "CHK_assets_checksum"
          CHECK ("checksum" IS NULL OR "checksum" ~ '^[0-9a-f]{64}$'),
        CONSTRAINT "CHK_assets_metadata"
          CHECK (jsonb_typeof("metadata") = 'object'),
        CONSTRAINT "CHK_assets_ready_state"
          CHECK ("status" <> 'READY' OR "ready_at" IS NOT NULL),
        CONSTRAINT "CHK_assets_deleted_state"
          CHECK (
            ("status" = 'DELETED' AND "deleted_at" IS NOT NULL) OR
            ("status" <> 'DELETED' AND "deleted_at" IS NULL)
          ),
        CONSTRAINT "CHK_assets_failure_state"
          CHECK (
            ("status" = 'FAILED' AND "failure_code" IS NOT NULL) OR
            ("status" <> 'FAILED' AND "failure_code" IS NULL)
          )
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_assets_bucket_storage_key"
      ON "assets" ("bucket", "storage_key")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_assets_user_purpose_status"
      ON "assets" ("user_id", "purpose", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_assets_status_updated_at"
      ON "assets" ("status", "updated_at")
      WHERE "status" IN ('PENDING_UPLOAD', 'DELETE_PENDING', 'FAILED')
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_assets_updated_at
      BEFORE UPDATE ON "assets"
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at()
    `);

    await queryRunner.query(`ALTER TABLE "users" ADD "avatar_asset_id" uuid`);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "UQ_users_avatar_asset_id" UNIQUE ("avatar_asset_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_avatar_asset"
      FOREIGN KEY ("avatar_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_avatar_asset"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_users_avatar_asset_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "avatar_asset_id"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_assets_updated_at ON "assets"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_assets_status_updated_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_assets_user_purpose_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_assets_bucket_storage_key"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assets"`);
  }
}
