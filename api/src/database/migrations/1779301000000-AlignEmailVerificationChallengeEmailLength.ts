import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignEmailVerificationChallengeEmailLength1779301000000 implements MigrationInterface {
  name = 'AlignEmailVerificationChallengeEmailLength1779301000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "email_verification_challenges"
      ALTER COLUMN "email" TYPE varchar(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "email_verification_challenges"
      ALTER COLUMN "email" TYPE varchar(320)
    `);
  }
}
