import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModifyAuthProviderEntityProperties1767118073795 implements MigrationInterface {
  name = 'ModifyAuthProviderEntityProperties1767118073795';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "auth_providers" DROP CONSTRAINT "UQ_auth_providers"`);
    await queryRunner.query(`ALTER TABLE "auth_providers" DROP COLUMN "provider"`);
    await queryRunner.query(`ALTER TABLE "auth_providers" ADD "provider" character varying(50) NOT NULL`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "initial_balance" SET DEFAULT '0.00'`);
    await queryRunner.query(
      `ALTER TABLE "auth_providers" ADD CONSTRAINT "UQ_auth_providers" UNIQUE ("provider", "provider_user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "auth_providers" DROP CONSTRAINT "UQ_auth_providers"`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "initial_balance" SET DEFAULT 0.00`);
    await queryRunner.query(`ALTER TABLE "auth_providers" DROP COLUMN "provider"`);
    await queryRunner.query(`ALTER TABLE "auth_providers" ADD "provider" character varying(100) NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "auth_providers" ADD CONSTRAINT "UQ_auth_providers" UNIQUE ("provider", "provider_user_id")`,
    );
  }
}
