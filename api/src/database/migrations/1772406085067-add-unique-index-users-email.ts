import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueIndexUsersEmail1772406085067 implements MigrationInterface {
  name = 'AddUniqueIndexUsersEmail1772406085067';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_email";`);
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_users_email" ON "users" ("email");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_email";`);
    await queryRunner.query(`CREATE INDEX "idx_users_email" ON "users" ("email");`);
  }
}
