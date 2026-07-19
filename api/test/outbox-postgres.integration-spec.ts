import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { OutboxMessageStatus } from '@/common/models/enums';
import { OutboxMessageOrmEntity } from '@/shared/outbox/persistence/outbox-message-orm.entity';
import { OutboxMessageRepository } from '@/shared/outbox/persistence/outbox-message.repository';
import { EmailMessageOrmEntity } from '@/modules/notifications/infrastructure/persistence/email-message-orm.entity';
import {
  BrevoTemplateId,
  EmailMessageStatus,
  EmailMessageType,
  EmailProviderKey,
  EmailTemplateKey,
} from '@/modules/notifications/domain/constants/email-message.constants';

type ExplainRow = { 'QUERY PLAN': string };

describe('Outbox PostgreSQL integration', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let ormRepository: Repository<OutboxMessageOrmEntity>;
  let repository: OutboxMessageRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    dataSource = new DataSource({
      type: 'postgres',
      url: container.getConnectionUri(),
      entities: [OutboxMessageOrmEntity, EmailMessageOrmEntity],
      synchronize: true,
      logging: false,
    });
    await dataSource.initialize();
    ormRepository = dataSource.getRepository(OutboxMessageOrmEntity);
    repository = new OutboxMessageRepository(ormRepository);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    await container?.stop();
  });

  beforeEach(async () => {
    await ormRepository.clear();
    await dataSource.getRepository(EmailMessageOrmEntity).clear();
  });

  const insertPendingMessages = async (count: number, maxAttempts = 10): Promise<void> => {
    const occurredAt = new Date();
    await ormRepository.save(
      Array.from({ length: count }, (_, index) =>
        ormRepository.create({
          eventName: 'integration.event',
          eventVersion: 1,
          aggregateType: 'IntegrationAggregate',
          aggregateId: randomUUID(),
          deduplicationKey: `integration:${randomUUID()}:${index}`,
          payload: { index },
          metadata: {},
          status: OutboxMessageStatus.PENDING,
          maxAttempts,
          occurredAt,
        }),
      ),
    );
  };

  it('claims disjoint messages with two concurrent worker instances', async () => {
    await insertPendingMessages(10);

    const [workerA, workerB] = await Promise.all([
      repository.claimReadyBatch({ lockedBy: 'worker-a', limit: 10, lockForMs: 30_000 }),
      repository.claimReadyBatch({ lockedBy: 'worker-b', limit: 10, lockForMs: 30_000 }),
    ]);

    const claimedIds = [...workerA, ...workerB].map(message => message.id);
    expect(claimedIds).toHaveLength(10);
    expect(new Set(claimedIds).size).toBe(10);
    expect(workerA.every(message => message.lockedBy === 'worker-a')).toBe(true);
    expect(workerB.every(message => message.lockedBy === 'worker-b')).toBe(true);
  });

  it('recovers an expired processing lease with a new owner', async () => {
    await insertPendingMessages(1);
    const [firstClaim] = await repository.claimReadyBatch({
      lockedBy: 'worker-old',
      limit: 1,
      lockForMs: 30_000,
    });
    await ormRepository.update(firstClaim.id, { lockedUntil: new Date(Date.now() - 1_000) });

    const [recovered] = await repository.claimReadyBatch({
      lockedBy: 'worker-new',
      limit: 1,
      lockForMs: 30_000,
    });

    expect(recovered.id).toBe(firstClaim.id);
    expect(recovered.lockedBy).toBe('worker-new');
    expect(recovered.attempts).toBe(2);
  });

  it('rejects every final transition and renewal attempted by a stale worker', async () => {
    await insertPendingMessages(1, 2);
    const [staleClaim] = await repository.claimReadyBatch({
      lockedBy: 'worker-stale',
      limit: 1,
      lockForMs: 30_000,
    });
    await ormRepository.update(staleClaim.id, { lockedUntil: new Date(Date.now() - 1_000) });
    const [currentClaim] = await repository.claimReadyBatch({
      lockedBy: 'worker-current',
      limit: 1,
      lockForMs: 30_000,
    });

    await expect(repository.markPublished(staleClaim.id, 'worker-stale')).resolves.toBe(false);
    await expect(repository.markFailed(staleClaim, 'worker-stale', new Error('retryable'))).resolves.toBe(false);
    await expect(
      repository.markFailed({ ...staleClaim, attempts: staleClaim.maxAttempts }, 'worker-stale', new Error('dead')),
    ).resolves.toBe(false);
    await expect(repository.extendLease(staleClaim.id, 'worker-stale', 30_000)).resolves.toBe(false);

    await expect(repository.markPublished(currentClaim.id, 'worker-current')).resolves.toBe(true);
    await expect(ormRepository.findOneByOrFail({ id: currentClaim.id })).resolves.toMatchObject({
      status: OutboxMessageStatus.PUBLISHED,
      lockedBy: null,
    });
  });

  it('uses an indexed plan for the outbox claim query with a representative backlog', async () => {
    await dataSource.query(`
      INSERT INTO outbox_messages (
        event_name, event_version, aggregate_type, aggregate_id, deduplication_key,
        payload, metadata, status, attempts, max_attempts, occurred_at
      )
      SELECT
        'published.event', 1, 'IntegrationAggregate', gen_random_uuid(), NULL,
        '{}'::jsonb, '{}'::jsonb, 'PUBLISHED', 1, 10, NOW()
      FROM generate_series(1, 5000)
    `);
    await insertPendingMessages(25);
    await dataSource.query('ANALYZE outbox_messages');

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const rows = (await queryRunner.query(`
        EXPLAIN (ANALYZE, BUFFERS)
        WITH picked AS (
          SELECT id
          FROM outbox_messages
          WHERE (
            status = 'PENDING'
            OR (status = 'FAILED' AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
            OR (status = 'PROCESSING' AND locked_until <= NOW())
          )
          AND attempts < max_attempts
          ORDER BY occurred_at ASC, created_at ASC
          LIMIT 25
          FOR UPDATE SKIP LOCKED
        )
        UPDATE outbox_messages AS outbox
        SET status = 'PROCESSING', locked_by = 'explain-worker',
            locked_until = NOW() + INTERVAL '30 seconds', attempts = outbox.attempts + 1
        FROM picked
        WHERE outbox.id = picked.id
      `)) as ExplainRow[];
      const plan = rows.map(row => row['QUERY PLAN']).join('\n');

      expect(plan).toContain('Update on outbox_messages');
      expect(plan).toMatch(/idx_outbox_messages_(ready|expired_locks)/);
      expect(plan).toContain('Buffers:');
    } finally {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
    }
  });

  it('uses the status and creation index to find stale reenqueuable email messages', async () => {
    await dataSource.query(
      `
        INSERT INTO email_messages (
          type, recipient_email, recipient_name, provider, template_key,
          provider_template_id, template_params, idempotency_key, status, created_at, updated_at
        )
        SELECT
          $1, 'terminal-' || sequence || '@example.com', NULL, $2, $3,
          $4, '{}'::jsonb, 'terminal:' || sequence, $5, NOW() - INTERVAL '1 day', NOW()
        FROM generate_series(1, 5000) AS sequence
      `,
      [
        EmailMessageType.EMAIL_VERIFICATION,
        EmailProviderKey.BREVO,
        EmailTemplateKey.EMAIL_VERIFICATION,
        BrevoTemplateId.EMAIL_VERIFICATION,
        EmailMessageStatus.SENT,
      ],
    );
    await dataSource.query(
      `
        INSERT INTO email_messages (
          type, recipient_email, recipient_name, provider, template_key,
          provider_template_id, template_params, idempotency_key, status, created_at, updated_at
        )
        SELECT
          $1, 'pending-' || sequence || '@example.com', NULL, $2, $3,
          $4, '{}'::jsonb, 'pending:' || sequence, $5, NOW() - INTERVAL '1 minute', NOW()
        FROM generate_series(1, 25) AS sequence
      `,
      [
        EmailMessageType.EMAIL_VERIFICATION,
        EmailProviderKey.BREVO,
        EmailTemplateKey.EMAIL_VERIFICATION,
        BrevoTemplateId.EMAIL_VERIFICATION,
        EmailMessageStatus.PENDING,
      ],
    );
    await dataSource.query('ANALYZE email_messages');

    const rows = await dataSource.query<ExplainRow[]>(
      `
        EXPLAIN (ANALYZE, BUFFERS)
        SELECT id
        FROM email_messages
        WHERE status IN ($1, $2)
          AND created_at <= NOW() - INTERVAL '30 seconds'
        ORDER BY created_at ASC
        LIMIT 100
      `,
      [EmailMessageStatus.PENDING, EmailMessageStatus.FAILED_RETRYABLE],
    );
    const plan = rows.map(row => row['QUERY PLAN']).join('\n');

    expect(plan).toContain('idx_email_messages_status_created_at');
    expect(plan).toContain('Buffers:');
  });
});
