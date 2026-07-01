import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailMessagesUpdatedAtTrigger1779200000000 implements MigrationInterface {
  name = 'AddEmailMessagesUpdatedAtTrigger1779200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_email_messages_updated_at ON "email_messages"`);
    await queryRunner.query(`
      CREATE TRIGGER trg_email_messages_updated_at
      BEFORE UPDATE ON "email_messages"
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_email_messages_updated_at ON "email_messages"`);
  }
}
