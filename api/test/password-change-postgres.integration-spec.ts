import { AddUserCredentialVersion1785438000000 } from '@/database/migrations/1785438000000-AddUserCredentialVersion';
import { CreatePasswordChangeEvents1785007879996 } from '@/database/migrations/1785007879996-CreatePasswordChangeEvents';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

type ExplainRow = { 'QUERY PLAN': string };

describe('Password change PostgreSQL integration', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  const userId = randomUUID();
  const providerId = randomUUID();

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    dataSource = new DataSource({
      type: 'postgres',
      url: container.getConnectionUri(),
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await dataSource.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid()
      )
    `);
    await dataSource.query(`
      CREATE TABLE auth_providers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await dataSource.query('INSERT INTO users (id) VALUES ($1)', [userId]);
    await dataSource.query('INSERT INTO auth_providers (id, user_id) VALUES ($1, $2)', [providerId, userId]);

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await new CreatePasswordChangeEvents1785007879996().up(queryRunner);
      await new AddUserCredentialVersion1785438000000().up(queryRunner);
    } finally {
      await queryRunner.release();
    }
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    await container.stop();
  });

  it('persists valid audit facts and enforces block coherence', async () => {
    const occurredAt = new Date('2026-07-30T12:00:00.000Z');

    await expect(
      dataSource.query(
        `
          INSERT INTO password_change_events (
            user_id, auth_provider_id, event_type, occurred_at
          ) VALUES ($1, $2, 'CURRENT_PASSWORD_FAILED', $3)
        `,
        [userId, providerId, occurredAt],
      ),
    ).resolves.toBeDefined();

    await expect(
      dataSource.query(
        `
          INSERT INTO password_change_events (
            user_id, auth_provider_id, event_type, occurred_at, blocked_until
          ) VALUES ($1, $2, 'FAILED_ATTEMPTS_BLOCK_STARTED', $3, $3)
        `,
        [userId, providerId, occurredAt],
      ),
    ).rejects.toMatchObject({
      constraint: 'CHK_password_change_events_block',
    });
  });

  it('rejects unknown event types and non-object metadata', async () => {
    await expect(
      dataSource.query(
        `
          INSERT INTO password_change_events (
            user_id, auth_provider_id, event_type
          ) VALUES ($1, $2, 'UNKNOWN')
        `,
        [userId, providerId],
      ),
    ).rejects.toMatchObject({
      constraint: 'CHK_password_change_events_type',
    });

    await expect(
      dataSource.query(
        `
          INSERT INTO password_change_events (
            user_id, auth_provider_id, event_type, metadata
          ) VALUES ($1, $2, 'PASSWORD_CHANGED', '[]'::jsonb)
        `,
        [userId, providerId],
      ),
    ).rejects.toMatchObject({
      constraint: 'CHK_password_change_events_metadata',
    });
  });

  it('adds a positive credential version with a legacy-safe default', async () => {
    const [user] = await dataSource.query<Array<{ credential_version: number }>>(
      'SELECT credential_version FROM users WHERE id = $1',
      [userId],
    );

    expect(user.credential_version).toBe(1);
    await expect(
      dataSource.query('UPDATE users SET credential_version = 0 WHERE id = $1', [userId]),
    ).rejects.toMatchObject({
      constraint: 'CHK_users_credential_version',
    });
  });

  it('uses the composite history index for a user window query', async () => {
    await dataSource.query(`
      INSERT INTO users (id)
      SELECT gen_random_uuid()
      FROM generate_series(1, 100)
    `);
    await dataSource.query(
      `
        INSERT INTO password_change_events (user_id, event_type, occurred_at)
        SELECT id, 'CURRENT_PASSWORD_FAILED', NOW() - (sequence || ' minutes')::interval
        FROM users
        CROSS JOIN generate_series(1, 50) AS sequence
        WHERE id <> $1
      `,
      [userId],
    );
    await dataSource.query('ANALYZE password_change_events');

    const rows = await dataSource.query<ExplainRow[]>(
      `
        EXPLAIN (ANALYZE, BUFFERS)
        SELECT id, occurred_at
        FROM password_change_events
        WHERE user_id = $1
          AND event_type = 'CURRENT_PASSWORD_FAILED'
          AND occurred_at >= NOW() - INTERVAL '15 minutes'
        ORDER BY occurred_at DESC
      `,
      [userId],
    );
    const plan = rows.map(row => row['QUERY PLAN']).join('\n');

    expect(plan).toContain('idx_password_change_events_user_type_occurred_at');
    expect(plan).toContain('Buffers:');
  });
});
