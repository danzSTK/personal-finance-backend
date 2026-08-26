import { AddEmailVerificationResendState1787616000000 } from '@/database/migrations/1787616000000-AddEmailVerificationResendState';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryRunner } from 'typeorm';

interface ColumnRow {
  column_name: string;
  is_nullable: 'YES' | 'NO';
}

describe('Email verification resend PostgreSQL migration', () => {
  let postgres: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  const migration = new AddEmailVerificationResendState1787616000000();

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('danfy_email_verification')
      .withUsername('danfy')
      .withPassword('integration-postgres-password')
      .start();
    dataSource = new DataSource({
      type: 'postgres',
      url: postgres.getConnectionUri(),
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    await postgres?.stop();
  });

  beforeEach(async () => {
    await dataSource.query('DROP TABLE IF EXISTS "email_messages"');
    await dataSource.query('DROP TABLE IF EXISTS "email_verification_challenges"');
    await dataSource.query(`
      CREATE TABLE "email_verification_challenges" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "purpose" varchar(50) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await dataSource.query(`
      CREATE TABLE "email_messages" (
        "id" uuid PRIMARY KEY,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  });

  it('backfills legacy rows, enforces both contracts and supports up/down/up', async () => {
    const legacyId = randomUUID();
    const userId = randomUUID();
    await dataSource.query(
      `INSERT INTO "email_verification_challenges" ("id", "user_id", "purpose") VALUES ($1, $2, $3)`,
      [legacyId, userId, 'EMAIL_VERIFICATION'],
    );

    await runMigration(queryRunner => migration.up(queryRunner));

    await expect(
      dataSource.query(`SELECT "origin" FROM "email_verification_challenges" WHERE "id" = $1`, [legacyId]),
    ).resolves.toEqual([{ origin: 'LEGACY_UNKNOWN' }]);
    await expect(insertChallenge(randomUUID(), randomUUID(), 'INVALID_ORIGIN')).rejects.toMatchObject({
      driverError: { constraint: 'CHK_email_verification_challenges_origin' },
    });

    const automaticUserId = randomUUID();
    await insertChallenge(randomUUID(), automaticUserId, 'AUTOMATIC');
    await expect(insertChallenge(randomUUID(), automaticUserId, 'AUTOMATIC')).rejects.toMatchObject({
      driverError: { constraint: 'UQ_email_verification_challenges_automatic_user_purpose' },
    });
    await insertChallenge(randomUUID(), automaticUserId, 'MANUAL_RESEND');
    await insertChallenge(randomUUID(), automaticUserId, 'MANUAL_RESEND');

    const createdAt = new Date('2026-08-26T00:00:00.000Z');
    await dataSource.query(
      `INSERT INTO "email_messages" ("id", "created_at", "deliver_before") VALUES ($1, $2, NULL)`,
      [randomUUID(), createdAt],
    );
    await dataSource.query(`INSERT INTO "email_messages" ("id", "created_at", "deliver_before") VALUES ($1, $2, $3)`, [
      randomUUID(),
      createdAt,
      new Date(createdAt.getTime() + 1),
    ]);
    await expect(
      dataSource.query(`INSERT INTO "email_messages" ("id", "created_at", "deliver_before") VALUES ($1, $2, $2)`, [
        randomUUID(),
        createdAt,
      ]),
    ).rejects.toMatchObject({ driverError: { constraint: 'CHK_email_messages_deliver_before' } });

    await runMigration(queryRunner => migration.down(queryRunner));
    await expect(loadColumns('email_verification_challenges')).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ column_name: 'origin' })]),
    );
    await expect(loadColumns('email_messages')).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ column_name: 'deliver_before' })]),
    );

    await runMigration(queryRunner => migration.up(queryRunner));
    await expect(loadColumns('email_verification_challenges')).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ column_name: 'origin', is_nullable: 'NO' })]),
    );
    await expect(loadColumns('email_messages')).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ column_name: 'deliver_before', is_nullable: 'YES' })]),
    );
  });

  const insertChallenge = async (id: string, userId: string, origin: string): Promise<void> => {
    await dataSource.query(
      `
        INSERT INTO "email_verification_challenges" ("id", "user_id", "purpose", "origin")
        VALUES ($1, $2, 'EMAIL_VERIFICATION', $3)
      `,
      [id, userId, origin],
    );
  };

  const runMigration = async (operation: (queryRunner: QueryRunner) => Promise<void>): Promise<void> => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await operation(queryRunner);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  };

  const loadColumns = async (tableName: string): Promise<ColumnRow[]> =>
    await dataSource.query<ColumnRow[]>(
      `
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `,
      [tableName],
    );
});
