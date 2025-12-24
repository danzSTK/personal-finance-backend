import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameNameAndAddFirstLastNames1766590600991 implements MigrationInterface {
  name = 'RenameNameAndAddFirstLastNames1766590600991';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "name"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "user_name" character varying(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_074a1f262efaca6aba16f7ed920" UNIQUE ("user_name")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "first_name" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "last_name" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "initial_balance" SET DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "initial_balance" SET DEFAULT 0.00`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_name"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "first_name"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_074a1f262efaca6aba16f7ed920"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "user_name"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "name" character varying(255)`,
    );
  }
}
