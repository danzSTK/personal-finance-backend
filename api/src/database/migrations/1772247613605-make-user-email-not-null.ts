import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeUserEmailNotNull1772247613605 implements MigrationInterface {
  name = 'MakeUserEmailNotNull1772247613605';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`);
  }
}
