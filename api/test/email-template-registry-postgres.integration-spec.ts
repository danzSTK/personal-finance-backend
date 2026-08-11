import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { CreateEmailMessages1779100000000 } from '@/database/migrations/1779100000000-CreateEmailMessages';
import { UseLogicalEmailTemplateReferences1785715200000 } from '@/database/migrations/1785715200000-UseLogicalEmailTemplateReferences';
import { DataSource, QueryRunner } from 'typeorm';

interface EmailMessageMigrationRow {
  template_key: string;
  template_version: number;
  provider: string | null;
  status: string;
}

interface ColumnRow {
  column_name: string;
  is_nullable: 'YES' | 'NO';
}

describe('Email template registry PostgreSQL migration', () => {
  let postgres: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  const createEmailMessages = new CreateEmailMessages1779100000000();
  const migration = new UseLogicalEmailTemplateReferences1785715200000();

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('danfy_email_templates')
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

  beforeEach(async () => {
    await dataSource.query('DROP TABLE IF EXISTS "email_messages"');
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await createEmailMessages.up(queryRunner);
    } finally {
      await queryRunner.release();
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    await postgres?.stop();
  });

  it('backfills v1, clears legacy provider intent and removes the external template id', async () => {
    await insertLegacyMessage('welcome-email', '2', 'SENT');
    await insertLegacyMessage('email-verification', '3', 'FAILED_PERMANENT');

    await runMigration(queryRunner => migration.up(queryRunner));

    const rows = await dataSource.query<EmailMessageMigrationRow[]>(`
      SELECT template_key, template_version, provider, status
      FROM email_messages
      ORDER BY template_key
    `);
    const columns = await loadColumns();

    expect(rows).toEqual([
      {
        template_key: 'email-verification',
        template_version: 1,
        provider: null,
        status: 'FAILED_PERMANENT',
      },
      {
        template_key: 'welcome-email',
        template_version: 1,
        provider: 'brevo',
        status: 'SENT',
      },
    ]);
    expect(columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column_name: 'template_version', is_nullable: 'NO' }),
        expect.objectContaining({ column_name: 'provider', is_nullable: 'YES' }),
      ]),
    );
    expect(columns.some(column => column.column_name === 'provider_template_id')).toBe(false);

    await runMigration(queryRunner => migration.down(queryRunner));

    const revertedColumns = await loadColumns();
    expect(revertedColumns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column_name: 'provider_template_id', is_nullable: 'NO' }),
        expect.objectContaining({ column_name: 'provider', is_nullable: 'NO' }),
      ]),
    );
    expect(revertedColumns.some(column => column.column_name === 'template_version')).toBe(false);
  });

  it('rolls back when a reenqueuable message exists', async () => {
    await insertLegacyMessage('welcome-email', '2', 'PENDING');

    await expect(runMigration(queryRunner => migration.up(queryRunner))).rejects.toThrow(
      'Cannot migrate email_messages while reenqueuable messages exist',
    );

    const columns = await loadColumns();
    expect(columns.some(column => column.column_name === 'provider_template_id')).toBe(true);
    expect(columns.some(column => column.column_name === 'template_version')).toBe(false);
  });

  it('rolls back when an unknown template key exists', async () => {
    await insertLegacyMessage('unknown-template', '99', 'SENT');

    await expect(runMigration(queryRunner => migration.up(queryRunner))).rejects.toThrow(
      'Cannot migrate email_messages with unknown template keys',
    );

    const columns = await loadColumns();
    expect(columns.some(column => column.column_name === 'provider_template_id')).toBe(true);
    expect(columns.some(column => column.column_name === 'template_version')).toBe(false);
  });

  const insertLegacyMessage = async (
    templateKey: string,
    providerTemplateId: string,
    status: string,
  ): Promise<void> => {
    await dataSource.query(
      `
        INSERT INTO email_messages (
          type, recipient_email, provider, template_key, provider_template_id,
          template_params, idempotency_key, status
        ) VALUES ($1, $2, 'brevo', $3, $4, '{}'::jsonb, $5, $6)
      `,
      [
        templateKey === 'welcome-email' ? 'WELCOME' : 'EMAIL_VERIFICATION',
        `${templateKey}@example.com`,
        templateKey,
        providerTemplateId,
        `migration:${templateKey}`,
        status,
      ],
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

  const loadColumns = async (): Promise<ColumnRow[]> =>
    await dataSource.query<ColumnRow[]>(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'email_messages'
      ORDER BY ordinal_position
    `);
});
