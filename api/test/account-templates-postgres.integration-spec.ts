import { ExpandAccountTemplates1787979500000 } from '@/database/migrations/1787979500000-ExpandAccountTemplates';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryRunner } from 'typeorm';

interface ColumnRow {
  column_name: string;
  is_nullable: 'YES' | 'NO';
}

interface ExplainRow {
  'QUERY PLAN': unknown;
}

describe('Account templates PostgreSQL expand migration', () => {
  let postgres: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  const migration = new ExpandAccountTemplates1787979500000();

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('danfy_account_templates')
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
    await dataSource.query('DROP TABLE IF EXISTS "account_templates" CASCADE');
    await dataSource.query('DROP TABLE IF EXISTS "accounts" CASCADE');
    await dataSource.query('DROP TABLE IF EXISTS "users" CASCADE');
    await dataSource.query(`
      CREATE OR REPLACE FUNCTION "set_updated_at"() RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await dataSource.query(`CREATE TABLE "users" ("id" uuid PRIMARY KEY)`);
    await dataSource.query(`
      CREATE TABLE "accounts" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "color" varchar(20),
        "icon" varchar(100),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  });

  it('requires expand before code N+1 queries and serves them after migration', async () => {
    await expect(dataSource.query(`SELECT "id" FROM "account_templates"`)).rejects.toMatchObject({
      driverError: { code: '42P01' },
    });

    await runMigration(queryRunner => migration.up(queryRunner));

    await expect(dataSource.query(`SELECT "id" FROM "account_templates"`)).resolves.toEqual([]);
  });

  it('lets concurrent reconciler workers skip rows already locked by another worker', async () => {
    await runMigration(queryRunner => migration.up(queryRunner));
    const userId = randomUUID();
    await dataSource.query(`INSERT INTO "users" ("id") VALUES ($1)`, [userId]);
    await insertCodeNAccount(randomUUID(), userId, 'blue', 'wallet');
    await insertCodeNAccount(randomUUID(), userId, 'purple', 'landmark');

    const firstWorker = dataSource.createQueryRunner();
    const secondWorker = dataSource.createQueryRunner();
    await firstWorker.connect();
    await secondWorker.connect();
    await firstWorker.startTransaction();
    await secondWorker.startTransaction();

    try {
      const firstRows: unknown = await firstWorker.query(`
        SELECT "id" FROM "accounts"
        WHERE "template_id" IS NULL
        ORDER BY "created_at", "id"
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `);
      const secondRows: unknown = await secondWorker.query(`
        SELECT "id" FROM "accounts"
        WHERE "template_id" IS NULL
        ORDER BY "created_at", "id"
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `);

      expect(firstRowId(firstRows)).not.toBe(firstRowId(secondRows));
    } finally {
      await firstWorker.rollbackTransaction();
      await secondWorker.rollbackTransaction();
      await firstWorker.release();
      await secondWorker.release();
    }
  });

  it('uses idx_accounts_template_id for selective template lookups at representative local volume', async () => {
    await runMigration(queryRunner => migration.up(queryRunner));
    const userId = randomUUID();
    const institutionalId = randomUUID();
    await dataSource.query(`INSERT INTO "users" ("id") VALUES ($1)`, [userId]);
    await insertInstitutionalTemplate(institutionalId);
    await dataSource.query(
      `
        INSERT INTO "accounts" ("id", "user_id", "color", "icon", "template_id")
        SELECT gen_random_uuid(), $1, 'blue', 'wallet',
          CASE WHEN series <= 5 THEN $2::uuid ELSE NULL END
        FROM generate_series(1, 5000) AS series
      `,
      [userId, institutionalId],
    );
    await dataSource.query(`ANALYZE "accounts"`);

    const explain = await dataSource.query<ExplainRow[]>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT "id" FROM "accounts" WHERE "template_id" = $1`,
      [institutionalId],
    );

    expect(JSON.stringify(explain[0]['QUERY PLAN'])).toContain('idx_accounts_template_id');
  });

  it('preserves code N and enforces the expanded N+1 schema through up/down/up', async () => {
    const legacyUserId = randomUUID();
    const legacyAccountId = randomUUID();
    await dataSource.query(`INSERT INTO "users" ("id") VALUES ($1)`, [legacyUserId]);
    await insertCodeNAccount(legacyAccountId, legacyUserId, 'purple', 'landmark');

    await runMigration(queryRunner => migration.up(queryRunner));

    await expect(loadAccountColumns()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ column_name: 'template_id', is_nullable: 'YES' })]),
    );
    await expect(
      dataSource.query(`SELECT "color", "icon", "template_id" FROM "accounts" WHERE "id" = $1`, [legacyAccountId]),
    ).resolves.toEqual([{ color: 'purple', icon: 'landmark', template_id: null }]);

    const rollbackAccountId = randomUUID();
    await insertCodeNAccount(rollbackAccountId, legacyUserId, 'blue', 'wallet');
    await dataSource.query(`UPDATE "accounts" SET "color" = 'green', "icon" = 'coins' WHERE "id" = $1`, [
      rollbackAccountId,
    ]);
    await expect(
      dataSource.query(`SELECT "color", "icon", "template_id" FROM "accounts" WHERE "id" = $1`, [rollbackAccountId]),
    ).resolves.toEqual([{ color: 'green', icon: 'coins', template_id: null }]);

    const institutionalId = randomUUID();
    await insertInstitutionalTemplate(institutionalId);
    await dataSource.query(`UPDATE "accounts" SET "template_id" = $1 WHERE "id" = $2`, [
      institutionalId,
      legacyAccountId,
    ]);
    await expect(
      dataSource.query(`DELETE FROM "account_templates" WHERE "id" = $1`, [institutionalId]),
    ).rejects.toMatchObject({
      driverError: { constraint: 'FK_accounts_template' },
    });

    await expect(
      dataSource.query(`
        INSERT INTO "account_templates" (
          "template_type", "name", "is_active"
        ) VALUES ('CUSTOM', 'Sem owner', true)
      `),
    ).rejects.toMatchObject({ driverError: { constraint: 'CHK_account_templates_owner' } });

    const customUserId = randomUUID();
    const customAccountId = randomUUID();
    const customTemplateId = randomUUID();
    await dataSource.query(`INSERT INTO "users" ("id") VALUES ($1)`, [customUserId]);
    await dataSource.query(
      `
        INSERT INTO "account_templates" (
          "id", "template_type", "owner_user_id", "name", "color_token", "icon_key"
        ) VALUES ($1, 'CUSTOM', $2, 'Carteira', 'purple', 'wallet')
      `,
      [customTemplateId, customUserId],
    );
    await insertCodeNAccount(customAccountId, customUserId, 'purple', 'wallet');
    await dataSource.query(`UPDATE "accounts" SET "template_id" = $1 WHERE "id" = $2`, [
      customTemplateId,
      customAccountId,
    ]);
    await dataSource.query(`DELETE FROM "users" WHERE "id" = $1`, [customUserId]);
    await expect(dataSource.query(`SELECT "id" FROM "accounts" WHERE "id" = $1`, [customAccountId])).resolves.toEqual(
      [],
    );
    await expect(
      dataSource.query(`SELECT "id" FROM "account_templates" WHERE "id" = $1`, [customTemplateId]),
    ).resolves.toEqual([]);

    const indexes = await dataSource.query<{ indexname: string }[]>(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename IN ('accounts', 'account_templates')
    `);
    expect(indexes.map(index => index.indexname)).toEqual(
      expect.arrayContaining([
        'UQ_account_templates_catalog_key',
        'UQ_account_templates_bank_code',
        'UQ_account_templates_ispb',
        'idx_account_templates_owner_user_id',
        'idx_accounts_template_id',
      ]),
    );

    await runMigration(queryRunner => migration.down(queryRunner));
    await expect(loadAccountColumns()).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ column_name: 'template_id' })]),
    );
    await expect(dataSource.query(`SELECT to_regclass('public.account_templates') AS relation`)).resolves.toEqual([
      { relation: null },
    ]);

    await runMigration(queryRunner => migration.up(queryRunner));
    await expect(loadAccountColumns()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ column_name: 'template_id', is_nullable: 'YES' })]),
    );
  });

  const insertCodeNAccount = async (
    id: string,
    userId: string,
    color: string | null,
    icon: string | null,
  ): Promise<void> => {
    await dataSource.query(`INSERT INTO "accounts" ("id", "user_id", "color", "icon") VALUES ($1, $2, $3, $4)`, [
      id,
      userId,
      color,
      icon,
    ]);
  };

  const insertInstitutionalTemplate = async (id: string): Promise<void> => {
    await dataSource.query(
      `
        INSERT INTO "account_templates" (
          "id", "template_type", "catalog_key", "name", "color_token",
          "logo_storage_key", "bank_code", "ispb"
        ) VALUES ($1, 'INSTITUTIONAL', 'nubank', 'Nubank', 'nubank',
          'banking-institutions-icons/nubank.svg', 260, '18236120')
      `,
      [id],
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

  const loadAccountColumns = async (): Promise<ColumnRow[]> =>
    dataSource.query<ColumnRow[]>(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounts'
      ORDER BY ordinal_position
    `);
});

function firstRowId(rows: unknown): string {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Expected at least one locked account row.');
  }

  const firstRow: unknown = rows[0];

  if (typeof firstRow !== 'object' || firstRow === null || !('id' in firstRow) || typeof firstRow.id !== 'string') {
    throw new Error('Expected a locked account row with a string id.');
  }

  return firstRow.id;
}
