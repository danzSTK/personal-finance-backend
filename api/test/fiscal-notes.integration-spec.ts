import { CategoryType, AccountType, TransactionStatus, TransactionType, UserStatus } from '@/common/models/enums';
import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { toDateOnly } from '@/common/utils/date-only';
import { ENTITIES } from '@/config/entities';
import {
  DEFAULT_FISCAL_NOTES_CACHE_TTL_SECONDS,
  DEFAULT_FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES,
  DEFAULT_FISCAL_NOTES_HTTP_TIMEOUT_MS,
  type FiscalNotesConfig,
} from '@/config/fiscal-notes.config';
import type { ObservabilityConfig } from '@/config/observability.config';
import { CreateFiscalNotesTables1789000000000 } from '@/database/migrations/1789000000000-CreateFiscalNotesTables';
import { RedisService } from '@/database/redis/redis.service';
import { AccountBalanceLockAdapter } from '@/modules/accounts/infrastructure/adapters/account-balance-lock.adapter';
import { AccountOrmEntity } from '@/modules/accounts/infrastructure/persistence/account.entity';
import { AccountRepository } from '@/modules/accounts/infrastructure/persistence/account.repository';
import { AssetOrmEntity } from '@/modules/assets/infrastructure/persistence/asset-orm.entity';
import { AssetRepository } from '@/modules/assets/infrastructure/persistence/asset.repository';
import { CategoryRepository } from '@/modules/categories/infrastructure/persistence/category.repository';
import { CategoryOrmEntity } from '@/modules/categories/infrastructure/persistence/model/category.entity';
import {
  FiscalNoteAlreadyImportedError,
  FiscalNoteNotFoundError,
  FiscalNoteRateLimitExceededError,
  FiscalNoteResponseTooLargeError,
  SefazTemporarilyUnavailableError,
  TransactionAlreadyHasFiscalNoteError,
} from '@/modules/fiscal-notes/application/errors';
import { FiscalNoteQueryService } from '@/modules/fiscal-notes/application/services/fiscal-note-query.service';
import { FiscalNoteTransactionLifecycleAdapter } from '@/modules/fiscal-notes/application/services/fiscal-note-transaction-lifecycle.adapter';
import { GetFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/get-fiscal-note/get-fiscal-note.use-case';
import { GetTransactionFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/get-transaction-fiscal-note/get-transaction-fiscal-note.use-case';
import { ImportFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/import-fiscal-note/import-fiscal-note.use-case';
import { LinkFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/link-fiscal-note/link-fiscal-note.use-case';
import { ListFiscalNotesUseCase } from '@/modules/fiscal-notes/application/use-cases/list-fiscal-notes/list-fiscal-notes.use-case';
import { PreviewFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/preview-fiscal-note/preview-fiscal-note.use-case';
import { UnlinkTransactionFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/unlink-transaction-fiscal-note/unlink-transaction-fiscal-note.use-case';
import {
  FISCAL_NOTE_ACCESS_KEY_DATA_LENGTH,
  FiscalNoteAlertKeys,
  FiscalNoteDbConstraints,
  FiscalNoteListSorts,
  FiscalNoteLogEvents,
  FiscalNoteSupportedUfs,
  SEFAZ_CE_PARSER_VERSION,
  SEFAZ_CE_PATHS,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { RedisFiscalNoteCache } from '@/modules/fiscal-notes/infrastructure/cache/redis-fiscal-note.cache';
import { FiscalNoteItemOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-item-orm.entity';
import { FiscalNoteOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-orm.entity';
import { FiscalNotePaymentOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-payment-orm.entity';
import { FiscalNoteRepository } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note.repository';
import { FiscalNoteProviderRegistry } from '@/modules/fiscal-notes/infrastructure/providers/fiscal-note-provider.registry';
import { SefazCeHtmlParser } from '@/modules/fiscal-notes/infrastructure/providers/sefaz-ce/sefaz-ce-html.parser';
import { SefazCeHttpClient } from '@/modules/fiscal-notes/infrastructure/providers/sefaz-ce/sefaz-ce.http-client';
import { SefazCeProvider } from '@/modules/fiscal-notes/infrastructure/providers/sefaz-ce/sefaz-ce.provider';
import { RedisFiscalNoteRateLimiter } from '@/modules/fiscal-notes/infrastructure/rate-limit/redis-fiscal-note-rate-limiter';
import { TransactionFiscalNoteAdapter } from '@/modules/transactions/application/services/transaction-fiscal-note.adapter';
import { TransactionReferenceValidator } from '@/modules/transactions/application/services/transaction-reference-validator.service';
import { CreateTransactionUseCase } from '@/modules/transactions/application/use-cases/create-transaction/create-transaction.use-case';
import { DeleteTransactionUseCase } from '@/modules/transactions/application/use-cases/delete-transaction/delete-transaction.use-case';
import { GetTransactionUseCase } from '@/modules/transactions/application/use-cases/get-transaction/get-transaction.use-case';
import { ListTransactionsUseCase } from '@/modules/transactions/application/use-cases/list-transactions/list-transactions.use-case';
import { UpdateTransactionUseCase } from '@/modules/transactions/application/use-cases/update-transaction/update-transaction.use-case';
import {
  InvalidTransactionError,
  TransactionTypeDoesNotSupportFiscalNoteError,
} from '@/modules/transactions/domain/errors';
import { TransactionAttachmentOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-attachment-orm.entity';
import { TransactionAttachmentRepository } from '@/modules/transactions/infrastructure/persistence/transaction-attachment.repository';
import { TransactionOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-orm.entity';
import { TransactionRepository } from '@/modules/transactions/infrastructure/persistence/transaction.repository';
import { CircuitBreakerService, CircuitBreakerStates, type CircuitBreakerStateRecord } from '@/shared/circuit-breaker';
import { CIRCUIT_BREAKER_PROBE_KEY_SUFFIX } from '@/shared/circuit-breaker/constants/circuit-breaker.constants';
import {
  type IMetricsRecorder,
  type IOperationalAlertNotifier,
  OperationalAlertService,
  OperationalAlertSeverities,
  PinoLogLevels,
} from '@/shared/observability';
import { Logger } from '@nestjs/common';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { type AddressInfo } from 'node:net';
import { join } from 'node:path';
import { DataSource, QueryRunner } from 'typeorm';

const FIXTURES_DIR = join(process.cwd(), 'src/modules/fiscal-notes/infrastructure/providers/sefaz-ce/__fixtures__');
const FIXTURE_CANONICAL_KEY = '23261003539462000250651030000760541443208780';
const FIXTURE_CANONICAL_KEY_SPACED = '2326 1003 5394 6200 0250 6510 3000 0760 5414 4320 8780';

function computeMod11AccessKey(base43: string): string {
  let sum = 0;
  let weight = 2;

  for (let index = FISCAL_NOTE_ACCESS_KEY_DATA_LENGTH - 1; index >= 0; index -= 1) {
    sum += Number(base43[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  const checkDigit = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
  return `${base43}${checkDigit}`;
}

function buildValidCeKey(serialSuffix: string): string {
  const paddedSuffix = serialSuffix.padStart(9, '0').slice(-9);
  const base43 = `2326100353946200025065103${paddedSuffix}144320878`;
  return computeMod11AccessKey(base43);
}

function renderFixtureForKey(fixtureFile: string, accessKey: string): string {
  const html = readFileSync(join(FIXTURES_DIR, fixtureFile), 'utf8');
  const spacedKey = accessKey.replace(/(.{4})(?=.)/g, '$1 ');
  return html.replaceAll(FIXTURE_CANONICAL_KEY_SPACED, spacedKey).replaceAll(FIXTURE_CANONICAL_KEY, accessKey);
}

interface StubRecordedRequest {
  url: string;
  method: string;
  body: Record<string, unknown>;
}

type StubHandler = (req: StubRecordedRequest, res: ServerResponse, hitNumber: number) => Promise<void> | void;

interface UserFixtures {
  userId: string;
  accountId: string;
  expenseCategoryId: string;
  incomeCategoryId: string;
}

describe('Fiscal notes PostgreSQL + Redis + HTTP stub integration', () => {
  const redisPassword = 'fiscal-notes-integration-redis';
  const postgresPassword = 'fiscal-notes-integration-postgres';

  let postgresContainer: StartedPostgreSqlContainer | undefined;
  let redisContainer: StartedRedisContainer | undefined;
  let dataSource: DataSource | undefined;
  let redisClient: Redis | undefined;
  let redisService: RedisService | undefined;
  let stubServer: Server | undefined;
  let stubBaseUrl = '';

  let stubRequests: StubRecordedRequest[] = [];
  let activeStubHandler: StubHandler;

  let fiscalNoteRepository: FiscalNoteRepository;
  let transactionRepository: TransactionRepository;
  let attachmentRepository: TransactionAttachmentRepository;
  let assetRepository: AssetRepository;
  let accountRepository: AccountRepository;
  let categoryRepository: CategoryRepository;
  let accountBalanceLockPort: AccountBalanceLockAdapter;
  let transactionReferenceValidator: TransactionReferenceValidator;
  let transactionFiscalNotePort: TransactionFiscalNoteAdapter;
  let fiscalNoteLifecyclePort: FiscalNoteTransactionLifecycleAdapter;

  let alertSendMock: jest.Mock<
    ReturnType<IOperationalAlertNotifier['send']>,
    Parameters<IOperationalAlertNotifier['send']>
  >;
  let alertNotifier: IOperationalAlertNotifier;
  let operationalAlertService: OperationalAlertService;
  let pendingAlertDeliveries: Promise<void>[];
  let metricsRecorder: jest.Mocked<IMetricsRecorder>;
  let circuitBreakerService: CircuitBreakerService;

  let warnLoggerSpy: jest.SpyInstance;
  let logLoggerSpy: jest.SpyInstance;
  let errorLoggerSpy: jest.SpyInstance;

  const observabilityConfig: ObservabilityConfig = {
    logLevel: PinoLogLevels.SILENT,
    nodeEnv: 'production',
    processRole: 'api',
    telegram: {
      enabled: true,
      botToken: 'test-bot-token',
      chatId: 'test-chat-id',
      apiBaseUrl: 'https://api.telegram.invalid',
      timeoutMs: 1000,
    },
    alerts: {
      cooldownSeconds: {
        critical: 900,
        warn: 1800,
      },
    },
  };

  function createFiscalNotesConfig(overrides: Partial<FiscalNotesConfig> = {}): FiscalNotesConfig {
    return {
      sefazCe: {
        baseUrl: stubBaseUrl,
        ...overrides.sefazCe,
      },
      http: {
        timeoutMs: DEFAULT_FISCAL_NOTES_HTTP_TIMEOUT_MS,
        retryBackoffMs: 50,
        maxResponseBytes: DEFAULT_FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES,
        ...overrides.http,
      },
      cache: {
        ttlSeconds: DEFAULT_FISCAL_NOTES_CACHE_TTL_SECONDS,
        ...overrides.cache,
      },
      rateLimit: {
        userPerMinute: 5,
        userPerHour: 30,
        globalPerMinute: 40,
        ...overrides.rateLimit,
      },
      circuitBreaker: {
        failureThreshold: 5,
        cooldownSeconds: [60, 120, 300],
        ...overrides.circuitBreaker,
      },
    };
  }

  function buildFiscalNoteStack(configOverrides: Partial<FiscalNotesConfig> = {}) {
    const config = createFiscalNotesConfig(configOverrides);
    const cache = new RedisFiscalNoteCache(redisService!, config);
    const rateLimiter = new RedisFiscalNoteRateLimiter(redisService!, config, operationalAlertService);
    const httpClient = new SefazCeHttpClient(config);
    const htmlParser = new SefazCeHtmlParser();
    const sefazCeProvider = new SefazCeProvider(httpClient, htmlParser);
    const providerRegistry = new FiscalNoteProviderRegistry([sefazCeProvider]);

    const queryService = new FiscalNoteQueryService(
      cache,
      providerRegistry,
      circuitBreakerService,
      rateLimiter,
      config,
      metricsRecorder,
      operationalAlertService,
    );

    const previewUseCase = new PreviewFiscalNoteUseCase(queryService, fiscalNoteRepository, metricsRecorder);
    const importUseCase = new ImportFiscalNoteUseCase(
      queryService,
      fiscalNoteRepository,
      transactionFiscalNotePort,
      dataSource!,
      metricsRecorder,
    );
    const linkUseCase = new LinkFiscalNoteUseCase(
      queryService,
      fiscalNoteRepository,
      transactionFiscalNotePort,
      dataSource!,
      metricsRecorder,
    );
    const getFiscalNoteUseCase = new GetTransactionFiscalNoteUseCase(
      fiscalNoteRepository,
      transactionFiscalNotePort,
      metricsRecorder,
    );
    const unlinkFiscalNoteUseCase = new UnlinkTransactionFiscalNoteUseCase(
      fiscalNoteRepository,
      transactionFiscalNotePort,
      dataSource!,
      metricsRecorder,
    );
    const listFiscalNotesUseCase = new ListFiscalNotesUseCase(fiscalNoteRepository, metricsRecorder);
    const getFiscalNoteByIdUseCase = new GetFiscalNoteUseCase(fiscalNoteRepository, metricsRecorder);

    return {
      config,
      cache,
      rateLimiter,
      httpClient,
      queryService,
      previewUseCase,
      importUseCase,
      linkUseCase,
      getFiscalNoteUseCase,
      unlinkFiscalNoteUseCase,
      listFiscalNotesUseCase,
      getFiscalNoteByIdUseCase,
    };
  }

  function buildTransactionUseCases() {
    const createTransactionUseCase = new CreateTransactionUseCase(
      dataSource!,
      transactionRepository,
      accountBalanceLockPort,
      transactionReferenceValidator,
    );
    const getTransactionUseCase = new GetTransactionUseCase(
      transactionRepository,
      attachmentRepository,
      fiscalNoteLifecyclePort,
    );
    const listTransactionsUseCase = new ListTransactionsUseCase(
      transactionRepository,
      attachmentRepository,
      fiscalNoteLifecyclePort,
    );
    const updateTransactionUseCase = new UpdateTransactionUseCase(
      dataSource!,
      transactionRepository,
      attachmentRepository,
      accountBalanceLockPort,
      transactionReferenceValidator,
      fiscalNoteLifecyclePort,
    );
    const deleteTransactionUseCase = new DeleteTransactionUseCase(
      dataSource!,
      transactionRepository,
      attachmentRepository,
      assetRepository,
      accountBalanceLockPort,
      fiscalNoteLifecyclePort,
    );

    return {
      createTransactionUseCase,
      getTransactionUseCase,
      listTransactionsUseCase,
      updateTransactionUseCase,
      deleteTransactionUseCase,
    };
  }

  beforeAll(async () => {
    warnLoggerSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    logLoggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorLoggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    stubServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        let parsedBody: Record<string, unknown> = {};
        try {
          parsedBody = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
        } catch {
          parsedBody = {};
        }

        const recorded: StubRecordedRequest = {
          url: req.url ?? '/',
          method: req.method ?? 'POST',
          body: parsedBody,
        };
        stubRequests.push(recorded);

        Promise.resolve(activeStubHandler(recorded, res, stubRequests.length)).catch((err: unknown) => {
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });
    });

    await new Promise<void>(resolve => {
      stubServer!.listen(0, '127.0.0.1', () => resolve());
    });
    const address = stubServer.address() as AddressInfo;
    stubBaseUrl = `http://127.0.0.1:${address.port}`;

    [postgresContainer, redisContainer] = await Promise.all([
      new PostgreSqlContainer('postgres:16-alpine')
        .withDatabase('danfy_fiscal_notes_integration')
        .withUsername('danfy')
        .withPassword(postgresPassword)
        .start(),
      new RedisContainer('redis:7-alpine').withPassword(redisPassword).start(),
    ]);

    dataSource = new DataSource({
      type: 'postgres',
      url: postgresContainer.getConnectionUri(),
      entities: ENTITIES,
      migrations: [join(process.cwd(), 'src/database/migrations/*{.ts,.js}')],
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    redisClient = new Redis({
      host: redisContainer.getHost(),
      port: redisContainer.getPort(),
      password: redisPassword,
      maxRetriesPerRequest: 1,
    });
    redisService = new RedisService(redisClient);

    fiscalNoteRepository = new FiscalNoteRepository(
      dataSource.getRepository(FiscalNoteOrmEntity),
      dataSource.getRepository(FiscalNoteItemOrmEntity),
      dataSource.getRepository(FiscalNotePaymentOrmEntity),
    );
    transactionRepository = new TransactionRepository(dataSource.getRepository(TransactionOrmEntity));
    attachmentRepository = new TransactionAttachmentRepository(
      dataSource.getRepository(TransactionAttachmentOrmEntity),
    );
    assetRepository = new AssetRepository(dataSource.getRepository(AssetOrmEntity));
    accountRepository = new AccountRepository(dataSource.getRepository(AccountOrmEntity));
    categoryRepository = new CategoryRepository(dataSource.getRepository(CategoryOrmEntity));
    accountBalanceLockPort = new AccountBalanceLockAdapter(accountRepository);
    transactionReferenceValidator = new TransactionReferenceValidator(accountRepository, categoryRepository);
    const createTransactionUseCase = new CreateTransactionUseCase(
      dataSource,
      transactionRepository,
      accountBalanceLockPort,
      transactionReferenceValidator,
    );
    transactionFiscalNotePort = new TransactionFiscalNoteAdapter(transactionRepository, createTransactionUseCase);
    fiscalNoteLifecyclePort = new FiscalNoteTransactionLifecycleAdapter(fiscalNoteRepository);
    circuitBreakerService = new CircuitBreakerService(redisService);
  });

  afterAll(async () => {
    try {
      await new Promise<void>(resolve => {
        if (!stubServer) {
          resolve();
          return;
        }
        stubServer.close(() => resolve());
      });
    } finally {
      try {
        if (redisClient) {
          if (redisClient.status === 'ready') {
            await redisClient.quit();
          } else {
            redisClient.disconnect();
          }
        }
      } finally {
        try {
          if (dataSource?.isInitialized) {
            await dataSource.destroy();
          }
        } finally {
          try {
            await Promise.all([postgresContainer?.stop(), redisContainer?.stop()]);
          } finally {
            warnLoggerSpy?.mockRestore();
            logLoggerSpy?.mockRestore();
            errorLoggerSpy?.mockRestore();
          }
        }
      }
    }
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    stubRequests = [];
    activeStubHandler = (req, res) => {
      const requestedKey = typeof req.body.chave_acesso === 'string' ? req.body.chave_acesso : FIXTURE_CANONICAL_KEY;
      const html = renderFixtureForKey('sefaz-ce-complete-with-discount-and-consumer.html', requestedKey);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ xml: html }));
    };

    await redisClient!.flushdb();
    await dataSource!.query(
      'TRUNCATE TABLE "fiscal_note_payments", "fiscal_note_items", "fiscal_notes", "transactions", "categories", "accounts", "users" CASCADE',
    );

    alertSendMock = jest
      .fn<ReturnType<IOperationalAlertNotifier['send']>, Parameters<IOperationalAlertNotifier['send']>>()
      .mockResolvedValue(undefined);
    alertNotifier = {
      send: alertSendMock,
    };
    operationalAlertService = new OperationalAlertService(alertNotifier, observabilityConfig, redisService);
    pendingAlertDeliveries = [];
    const originalNotifyAsync = operationalAlertService.notifyAsync.bind(
      operationalAlertService,
    ) as OperationalAlertService['notifyAsync'];
    jest.spyOn(operationalAlertService, 'notifyAsync').mockImplementation(input => {
      const delivery = originalNotifyAsync(input);
      pendingAlertDeliveries.push(delivery);
      return delivery;
    });
    metricsRecorder = {
      incrementCounter: jest.fn(),
      observeDuration: jest.fn(),
    };
  });

  async function flushPendingAlerts(): Promise<void> {
    await Promise.all(pendingAlertDeliveries.splice(0, pendingAlertDeliveries.length));
  }

  async function seedUserFixtures(suffix: string): Promise<UserFixtures> {
    const userId = randomUUID();
    const accountId = randomUUID();
    const expenseCategoryId = randomUUID();
    const incomeCategoryId = randomUUID();

    await dataSource!.query(
      `INSERT INTO "users" ("id", "email", "status", "credential_version") VALUES ($1, $2, $3, 1)`,
      [userId, `fiscal-int-${suffix}-${userId}@example.com`, UserStatus.ACTIVE],
    );
    await dataSource!.query(
      `INSERT INTO "accounts" ("id", "user_id", "account_type", "name", "initial_balance_cents", "is_archived", "is_default")
       VALUES ($1, $2, $3, $4, 100000, false, true)`,
      [accountId, userId, AccountType.BANK, `Conta ${suffix}`],
    );
    await dataSource!.query(
      `INSERT INTO "categories" ("id", "user_id", "name", "display_name", "type", "is_system", "is_archived")
       VALUES ($1, $2, $3, $4, $5, false, false),
              ($6, $2, $7, $8, $9, false, false)`,
      [
        expenseCategoryId,
        userId,
        'mercado',
        'Mercado',
        CategoryType.EXPENSE,
        incomeCategoryId,
        'salario',
        'Salário',
        CategoryType.INCOME,
      ],
    );

    return { userId, accountId, expenseCategoryId, incomeCategoryId };
  }

  async function runMigration(operation: (queryRunner: QueryRunner) => Promise<void>): Promise<void> {
    const queryRunner = dataSource!.createQueryRunner();
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
  }

  it('executes CreateFiscalNotesTables1789000000000 down/up roundtrip and enforces constraints, indexes, and updated_at trigger', async () => {
    const migration = new CreateFiscalNotesTables1789000000000();

    await runMigration(queryRunner => migration.down(queryRunner));

    const relationsAfterDown = await dataSource!.query<
      Array<{ fn: string | null; items: string | null; payments: string | null }>
    >(`
      SELECT
        to_regclass('public.fiscal_notes') AS fn,
        to_regclass('public.fiscal_note_items') AS items,
        to_regclass('public.fiscal_note_payments') AS payments
    `);
    expect(relationsAfterDown).toEqual([{ fn: null, items: null, payments: null }]);
    const indexesAfterDown = await dataSource!.query<Array<{ indexname: string }>>(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_fiscal_notes_user_issued_at_active'
    `);
    expect(indexesAfterDown).toHaveLength(0);

    await runMigration(queryRunner => migration.up(queryRunner));

    const indexes = await dataSource!.query<Array<{ indexname: string; indexdef: string }>>(`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('fiscal_notes', 'fiscal_note_items', 'fiscal_note_payments')
    `);
    expect(indexes.map(row => row.indexname)).toEqual(
      expect.arrayContaining([
        'PK_fiscal_notes',
        FiscalNoteDbConstraints.USER_ACCESS_KEY_ACTIVE,
        FiscalNoteDbConstraints.TRANSACTION_ACTIVE,
        'idx_fiscal_notes_user_id',
        'idx_fiscal_notes_user_issued_at_active',
        'idx_fiscal_notes_transaction_id',
        'PK_fiscal_note_items',
        'UQ_fiscal_note_items_fiscal_note_position',
        'PK_fiscal_note_payments',
        'UQ_fiscal_note_payments_fiscal_note_position',
      ]),
    );
    const issuedAtPartialIndex = indexes.find(row => row.indexname === 'idx_fiscal_notes_user_issued_at_active');
    expect(issuedAtPartialIndex?.indexdef).toMatch(/issued_at DESC/i);
    expect(issuedAtPartialIndex?.indexdef).toMatch(/WHERE \(?deleted_at IS NULL\)?/i);
    const nonPartialFkIndexes = indexes.filter(row =>
      ['idx_fiscal_notes_user_id', 'idx_fiscal_notes_transaction_id'].includes(row.indexname),
    );
    expect(nonPartialFkIndexes).toHaveLength(2);
    for (const row of nonPartialFkIndexes) {
      expect(row.indexdef).not.toMatch(/\bWHERE\b/i);
    }

    const user = await seedUserFixtures('migration');
    const txId = randomUUID();
    await dataSource!.query(
      `INSERT INTO "transactions" ("id", "user_id", "account_id", "category_id", "type", "status", "amount_cents", "date", "effective_at")
       VALUES ($1, $2, $3, $4, 'EXPENSE', 'EFFECTIVE', 1000, '2026-10-15', now())`,
      [txId, user.userId, user.accountId, user.expenseCategoryId],
    );

    await expect(
      dataSource!.query(
        `INSERT INTO "fiscal_notes" (
          "user_id", "transaction_id", "access_key", "source_uf", "number", "series",
          "issued_at", "issuer_name", "issuer_cnpj", "gross_amount_cents", "payable_amount_cents", "parser_version"
        ) VALUES ($1, $2, 'invalid', '23', '1', '1', now(), 'Loja', '03539462000250', 1000, 1000, 'v1')`,
        [user.userId, txId],
      ),
    ).rejects.toMatchObject({
      driverError: { constraint: 'CHK_fiscal_notes_access_key_digits' },
    });

    await expect(
      dataSource!.query(
        `INSERT INTO "fiscal_notes" (
          "user_id", "transaction_id", "access_key", "source_uf", "number", "series",
          "issued_at", "issuer_name", "issuer_cnpj", "gross_amount_cents", "payable_amount_cents", "parser_version"
        ) VALUES ($1, $2, $3, '23', '1', '1', now(), 'Loja', '03539462000250', 1000, -1, 'v1')`,
        [user.userId, txId, FIXTURE_CANONICAL_KEY],
      ),
    ).rejects.toMatchObject({
      driverError: { constraint: 'CHK_fiscal_notes_payable_amount_cents' },
    });

    const noteId = randomUUID();
    const initialUpdatedAt = new Date('2026-01-01T00:00:00.000Z');
    await dataSource!.query(
      `INSERT INTO "fiscal_notes" (
        "id", "user_id", "transaction_id", "access_key", "source_uf", "number", "series",
        "issued_at", "issuer_name", "issuer_cnpj", "gross_amount_cents", "payable_amount_cents",
        "parser_version", "created_at", "updated_at"
      ) VALUES ($1, $2, $3, $4, '23', '1', '1', now(), 'Loja', '03539462000250', 1000, 1000, 'v1', $5, $5)`,
      [noteId, user.userId, txId, FIXTURE_CANONICAL_KEY, initialUpdatedAt],
    );

    await dataSource!.query(`UPDATE "fiscal_notes" SET "number" = '2' WHERE "id" = $1`, [noteId]);
    const [updatedRow] = await dataSource!.query<Array<{ updated_at: Date }>>(
      `SELECT "updated_at" FROM "fiscal_notes" WHERE "id" = $1`,
      [noteId],
    );
    expect(updatedRow.updated_at.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
  });

  it('imports atomically, discards consumer PII/HTML, isolates tenants by userId, and blocks duplicate import by same user', async () => {
    const userA = await seedUserFixtures('tenant-a');
    const userB = await seedUserFixtures('tenant-b');
    const stack = buildFiscalNoteStack();
    const txUseCases = buildTransactionUseCases();

    const qrInput = `http://nfce.sefaz.ce.gov.br/nfce/pagina?p=${FIXTURE_CANONICAL_KEY}|2|1|1|HASH1`;
    const importedA = await stack.importUseCase.execute({
      userId: userA.userId,
      input: qrInput,
      accountId: userA.accountId,
      categoryId: userA.expenseCategoryId,
    });

    expect(stubRequests).toHaveLength(1);
    expect(stubRequests[0].url).toBe(SEFAZ_CE_PATHS.QRCODE_V2);
    expect(importedA.transaction.type).toBe(TransactionType.EXPENSE);
    expect(importedA.transaction.amountCents).toBe(3141);
    expect(importedA.transaction.hasFiscalNote).toBe(true);
    expect(importedA.fiscalNote.accessKey).toBe(FIXTURE_CANONICAL_KEY);
    expect(importedA.fiscalNote.sourceUf).toBe(FiscalNoteSupportedUfs.CE);
    expect(importedA.fiscalNote.changeAmountCents).toBeNull();
    expect(importedA.fiscalNote.parserVersion).toBe(SEFAZ_CE_PARSER_VERSION);
    expect(importedA.fiscalNote.items).toHaveLength(6);
    expect(importedA.fiscalNote.payments).toHaveLength(1);

    const fetchedTx = await txUseCases.getTransactionUseCase.execute({
      userId: userA.userId,
      transactionId: importedA.transaction.id,
    });
    expect(fetchedTx.hasFiscalNote).toBe(true);

    const listedTx = await txUseCases.listTransactionsUseCase.execute({ userId: userA.userId });
    expect(listedTx.items).toHaveLength(1);
    expect(listedTx.items[0].hasFiscalNote).toBe(true);

    const dbNotes: unknown = await dataSource!.query(`SELECT * FROM "fiscal_notes" WHERE "id" = $1`, [
      importedA.fiscalNote.id,
    ]);
    const cachedRaw = await redisClient!.get(CacheKeys.fiscalNotes.parsed(FIXTURE_CANONICAL_KEY));
    const combinedSerialized = `${JSON.stringify(dbNotes)}${cachedRaw ?? ''}`;
    expect(combinedSerialized).not.toContain('123.456.789-00');
    expect(combinedSerialized).not.toContain('JOAO FULANO');
    expect(combinedSerialized).not.toContain('RUA PRIVADA');
    expect(combinedSerialized).not.toContain('<table');

    const importedB = await stack.importUseCase.execute({
      userId: userB.userId,
      input: FIXTURE_CANONICAL_KEY,
      accountId: userB.accountId,
      categoryId: userB.expenseCategoryId,
    });
    expect(importedB.fiscalNote.userId).toBe(userB.userId);
    expect(importedB.fiscalNote.id).not.toBe(importedA.fiscalNote.id);
    expect(stubRequests).toHaveLength(1);

    await expect(
      stack.importUseCase.execute({
        userId: userA.userId,
        input: FIXTURE_CANONICAL_KEY,
        accountId: userA.accountId,
        categoryId: userA.expenseCategoryId,
      }),
    ).rejects.toMatchObject({
      code: new FiscalNoteAlreadyImportedError(importedA.transaction.id, importedA.fiscalNote.id).code,
      existingTransactionId: importedA.transaction.id,
      existingFiscalNoteId: importedA.fiscalNote.id,
      details: {
        existingTransactionId: importedA.transaction.id,
        existingFiscalNoteId: importedA.fiscalNote.id,
      },
    });
  });

  it('rejects importing a note with payableAmountCents === 0 via CreateTransactionUseCase with INVALID_TRANSACTION and rolls back transaction + fiscal note', async () => {
    const user = await seedUserFixtures('zero-amount');
    const stack = buildFiscalNoteStack();
    const zeroKey = buildValidCeKey('000099000');

    activeStubHandler = (req, res) => {
      const requestedKey = typeof req.body.chave_acesso === 'string' ? req.body.chave_acesso : zeroKey;
      const html = renderFixtureForKey('sefaz-ce-no-discount-no-gross.html', requestedKey)
        .replaceAll('8,50', '0,00')
        .replaceAll('17,00', '0,00');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ xml: html }));
    };

    await expect(
      stack.importUseCase.execute({
        userId: user.userId,
        input: zeroKey,
        accountId: user.accountId,
        categoryId: user.expenseCategoryId,
      }),
    ).rejects.toBeInstanceOf(InvalidTransactionError);

    const [{ noteCount }] = await dataSource!.query<Array<{ noteCount: string }>>(
      `SELECT count(*)::text AS "noteCount" FROM "fiscal_notes" WHERE "user_id" = $1`,
      [user.userId],
    );
    const [{ txCount }] = await dataSource!.query<Array<{ txCount: string }>>(
      `SELECT count(*)::text AS "txCount" FROM "transactions" WHERE "user_id" = $1`,
      [user.userId],
    );
    expect(Number(noteCount)).toBe(0);
    expect(Number(txCount)).toBe(0);
  });

  it('handles concurrent duplicate import race condition cleanly via 23505 without 25P02 aborted transaction', async () => {
    const user = await seedUserFixtures('concurrency');
    const stack = buildFiscalNoteStack();
    const concurrentKey = buildValidCeKey('000099111');

    await stack.previewUseCase.execute({ userId: user.userId, input: concurrentKey });

    const results = await Promise.allSettled([
      stack.importUseCase.execute({
        userId: user.userId,
        input: concurrentKey,
        accountId: user.accountId,
        categoryId: user.expenseCategoryId,
      }),
      stack.importUseCase.execute({
        userId: user.userId,
        input: concurrentKey,
        accountId: user.accountId,
        categoryId: user.expenseCategoryId,
      }),
    ]);

    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<ImportFiscalNoteUseCase['execute']>>> =>
        result.status === 'fulfilled',
    );
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(FiscalNoteAlreadyImportedError);
    expect(rejected[0].reason).toMatchObject({
      existingTransactionId: fulfilled[0].value.transaction.id,
      existingFiscalNoteId: fulfilled[0].value.fiscalNote.id,
      details: {
        existingTransactionId: fulfilled[0].value.transaction.id,
        existingFiscalNoteId: fulfilled[0].value.fiscalNote.id,
      },
    });

    const [{ noteCount }] = await dataSource!.query<Array<{ noteCount: string }>>(
      `SELECT count(*)::text AS "noteCount" FROM "fiscal_notes" WHERE "user_id" = $1 AND "access_key" = $2 AND "deleted_at" IS NULL`,
      [user.userId, concurrentKey],
    );
    const [{ txCount }] = await dataSource!.query<Array<{ txCount: string }>>(
      `SELECT count(*)::text AS "txCount" FROM "transactions" WHERE "user_id" = $1 AND "deleted_at" IS NULL`,
      [user.userId],
    );
    expect(Number(noteCount)).toBe(1);
    expect(Number(txCount)).toBe(1);
  });

  it('links to existing expense without altering its fields, unlinks via soft delete, and allows re-import', async () => {
    const user = await seedUserFixtures('link-unlink');
    const stack = buildFiscalNoteStack();
    const txUseCases = buildTransactionUseCases();
    const key = buildValidCeKey('000099222');

    activeStubHandler = (req, res) => {
      const requestedKey = typeof req.body.chave_acesso === 'string' ? req.body.chave_acesso : key;
      const html = renderFixtureForKey('sefaz-ce-multi-payment-with-change.html', requestedKey);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ xml: html }));
    };

    const existingExpense = await txUseCases.createTransactionUseCase.execute({
      userId: user.userId,
      accountId: user.accountId,
      categoryId: user.expenseCategoryId,
      type: TransactionType.EXPENSE,
      status: TransactionStatus.EFFECTIVE,
      amountCents: 9999,
      date: toDateOnly('2026-11-01'),
      description: 'Despesa manual original',
    });

    const existingIncome = await txUseCases.createTransactionUseCase.execute({
      userId: user.userId,
      accountId: user.accountId,
      categoryId: user.incomeCategoryId,
      type: TransactionType.INCOME,
      status: TransactionStatus.EFFECTIVE,
      amountCents: 50000,
      date: toDateOnly('2026-11-01'),
      description: 'Receita teste',
    });

    await expect(
      stack.linkUseCase.execute({
        userId: user.userId,
        transactionId: existingIncome.id,
        input: key,
      }),
    ).rejects.toBeInstanceOf(TransactionTypeDoesNotSupportFiscalNoteError);

    const linkedNote = await stack.linkUseCase.execute({
      userId: user.userId,
      transactionId: existingExpense.id,
      input: key,
    });

    expect(linkedNote.transactionId).toBe(existingExpense.id);
    expect(linkedNote.changeAmountCents).toBe(500);
    expect(linkedNote.payments).toHaveLength(2);

    const expenseAfterLink = await txUseCases.getTransactionUseCase.execute({
      userId: user.userId,
      transactionId: existingExpense.id,
    });
    expect(expenseAfterLink.amountCents).toBe(9999);
    expect(expenseAfterLink.date).toBe('2026-11-01');
    expect(expenseAfterLink.description).toBe('Despesa manual original');
    expect(expenseAfterLink.accountId).toBe(user.accountId);
    expect(expenseAfterLink.categoryId).toBe(user.expenseCategoryId);
    expect(expenseAfterLink.hasFiscalNote).toBe(true);

    const otherKey = buildValidCeKey('000099223');
    await expect(
      stack.linkUseCase.execute({
        userId: user.userId,
        transactionId: existingExpense.id,
        input: otherKey,
      }),
    ).rejects.toMatchObject({
      code: new TransactionAlreadyHasFiscalNoteError(linkedNote.id).code,
      details: { existingFiscalNoteId: linkedNote.id },
    });

    await stack.unlinkFiscalNoteUseCase.execute({
      userId: user.userId,
      transactionId: existingExpense.id,
    });

    const [deletedNoteRow] = await dataSource!.query<Array<{ deleted_at: Date | null }>>(
      `SELECT "deleted_at" FROM "fiscal_notes" WHERE "id" = $1`,
      [linkedNote.id],
    );
    expect(deletedNoteRow.deleted_at).not.toBeNull();

    const expenseAfterUnlink = await txUseCases.getTransactionUseCase.execute({
      userId: user.userId,
      transactionId: existingExpense.id,
    });
    expect(expenseAfterUnlink.hasFiscalNote).toBe(false);

    await expect(
      stack.getFiscalNoteUseCase.execute({
        userId: user.userId,
        transactionId: existingExpense.id,
      }),
    ).rejects.toBeInstanceOf(FiscalNoteNotFoundError);

    const reimported = await stack.importUseCase.execute({
      userId: user.userId,
      input: key,
      accountId: user.accountId,
      categoryId: user.expenseCategoryId,
    });
    expect(reimported.fiscalNote.accessKey).toBe(key);
    expect(reimported.fiscalNote.id).not.toBe(linkedNote.id);
  });

  it('blocks type change to non-EXPENSE and soft-deletes fiscal note atomically with DeleteTransactionUseCase', async () => {
    const user = await seedUserFixtures('tx-sync');
    const stack = buildFiscalNoteStack();
    const txUseCases = buildTransactionUseCases();
    const key = buildValidCeKey('000099333');

    const imported = await stack.importUseCase.execute({
      userId: user.userId,
      input: key,
      accountId: user.accountId,
      categoryId: user.expenseCategoryId,
    });

    await expect(
      txUseCases.updateTransactionUseCase.execute({
        userId: user.userId,
        transactionId: imported.transaction.id,
        patch: {
          type: TransactionType.INCOME,
          categoryId: user.incomeCategoryId,
        },
      }),
    ).rejects.toBeInstanceOf(TransactionTypeDoesNotSupportFiscalNoteError);

    await txUseCases.deleteTransactionUseCase.execute({
      userId: user.userId,
      transactionId: imported.transaction.id,
    });

    const [txRow] = await dataSource!.query<Array<{ deleted_at: Date | null }>>(
      `SELECT "deleted_at" FROM "transactions" WHERE "id" = $1`,
      [imported.transaction.id],
    );
    const [noteRow] = await dataSource!.query<Array<{ deleted_at: Date | null }>>(
      `SELECT "deleted_at" FROM "fiscal_notes" WHERE "id" = $1`,
      [imported.fiscalNote.id],
    );
    expect(txRow.deleted_at).not.toBeNull();
    expect(noteRow.deleted_at).not.toBeNull();

    const reimported = await stack.importUseCase.execute({
      userId: user.userId,
      input: key,
      accountId: user.accountId,
      categoryId: user.expenseCategoryId,
    });
    expect(reimported.fiscalNote.accessKey).toBe(key);
    expect(reimported.transaction.id).not.toBe(imported.transaction.id);
  });

  it('uses real Redis cache with TTL and serves cache hits even when Circuit Breaker is OPEN', async () => {
    const user = await seedUserFixtures('cache-cb-bypass');
    const stack = buildFiscalNoteStack({ cache: { ttlSeconds: 300 } });
    const key = buildValidCeKey('000099444');
    const cacheKey = CacheKeys.fiscalNotes.parsed(key);

    const first = await stack.previewUseCase.execute({ userId: user.userId, input: key });
    expect(first.cacheHit).toBe(false);
    expect(stubRequests).toHaveLength(1);

    const ttl = await redisClient!.ttl(cacheKey);
    expect(ttl).toBeGreaterThan(250);
    expect(ttl).toBeLessThanOrEqual(300);

    const openRecord: CircuitBreakerStateRecord = {
      state: CircuitBreakerStates.OPEN,
      consecutiveFailures: 5,
      cooldownStage: 0,
      openedAtMs: Date.now(),
      nextAttemptAtMs: Date.now() + 60_000,
    };
    await redisClient!.set(
      CacheKeys.fiscalNotes.circuitBreaker(FiscalNoteSupportedUfs.CE),
      JSON.stringify(openRecord),
      'EX',
      300,
    );

    const second = await stack.previewUseCase.execute({ userId: user.userId, input: key });
    expect(second.cacheHit).toBe(true);
    expect(second.fiscalNote.accessKey).toBe(key);
    expect(stubRequests).toHaveLength(1);
  });

  it('enforces Lua user rate limit without consuming global UF bucket and alerts WARN on global UF limit', async () => {
    const user1 = await seedUserFixtures('rl-1');
    const user2 = await seedUserFixtures('rl-2');
    const user3 = await seedUserFixtures('rl-3');

    const stack = buildFiscalNoteStack({
      rateLimit: {
        userPerMinute: 2,
        userPerHour: 10,
        globalPerMinute: 3,
      },
    });

    await stack.previewUseCase.execute({ userId: user1.userId, input: buildValidCeKey('000010001') });
    await stack.previewUseCase.execute({ userId: user1.userId, input: buildValidCeKey('000010002') });

    const globalKey = CacheKeys.fiscalNotes.rateLimitGlobal1m(FiscalNoteSupportedUfs.CE);
    expect(await redisClient!.get(globalKey)).toBe('2');

    let userLimitError: unknown;
    try {
      await stack.previewUseCase.execute({ userId: user1.userId, input: buildValidCeKey('000010003') });
    } catch (error) {
      userLimitError = error;
    }

    expect(userLimitError).toBeInstanceOf(FiscalNoteRateLimitExceededError);
    expect((userLimitError as FiscalNoteRateLimitExceededError).retryAfterSeconds).toBeGreaterThan(0);
    expect(stubRequests).toHaveLength(2);
    expect(await redisClient!.get(globalKey)).toBe('2');

    await stack.previewUseCase.execute({ userId: user2.userId, input: buildValidCeKey('000010004') });
    expect(await redisClient!.get(globalKey)).toBe('3');

    await expect(
      stack.previewUseCase.execute({ userId: user3.userId, input: buildValidCeKey('000010005') }),
    ).rejects.toBeInstanceOf(SefazTemporarilyUnavailableError);
    expect(stubRequests).toHaveLength(3);

    await flushPendingAlerts();
    expect(alertSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        alertKey: FiscalNoteAlertKeys.sefazGlobalRateLimit(FiscalNoteSupportedUfs.CE),
        event: FiscalNoteLogEvents.FISCAL_NOTE_SEFAZ_GLOBAL_RL_HIT,
        severity: OperationalAlertSeverities.WARN,
      }),
    );
  });

  it('opens Circuit Breaker after consecutive 503 failures, progresses cooldown stage, and recovers with RESOLVED alert', async () => {
    const user = await seedUserFixtures('cb-flow');
    const stack = buildFiscalNoteStack({
      http: {
        timeoutMs: DEFAULT_FISCAL_NOTES_HTTP_TIMEOUT_MS,
        retryBackoffMs: 10,
        maxResponseBytes: DEFAULT_FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES,
      },
      circuitBreaker: {
        failureThreshold: 2,
        cooldownSeconds: [15, 45, 90],
      },
    });
    const cbKey = CacheKeys.fiscalNotes.circuitBreaker(FiscalNoteSupportedUfs.CE);

    activeStubHandler = (_req, res) => {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ erro: 'unavailable' }));
    };

    await expect(
      stack.previewUseCase.execute({ userId: user.userId, input: buildValidCeKey('000020001') }),
    ).rejects.toBeInstanceOf(SefazTemporarilyUnavailableError);
    await expect(
      stack.previewUseCase.execute({ userId: user.userId, input: buildValidCeKey('000020002') }),
    ).rejects.toBeInstanceOf(SefazTemporarilyUnavailableError);

    expect(stubRequests).toHaveLength(4);
    await flushPendingAlerts();
    expect(alertSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        alertKey: FiscalNoteAlertKeys.sefazCircuitBreaker(FiscalNoteSupportedUfs.CE),
        event: FiscalNoteLogEvents.FISCAL_NOTE_SEFAZ_CB_OPENED,
        severity: OperationalAlertSeverities.CRITICAL,
      }),
    );

    let openRejection: unknown;
    try {
      await stack.previewUseCase.execute({ userId: user.userId, input: buildValidCeKey('000020003') });
    } catch (error) {
      openRejection = error;
    }
    expect(openRejection).toBeInstanceOf(SefazTemporarilyUnavailableError);
    expect((openRejection as SefazTemporarilyUnavailableError).retryAfterSeconds).toBeGreaterThan(0);
    expect(stubRequests).toHaveLength(4);

    await expireCircuitBreakerCooldownInRedis(redisClient!, cbKey);

    await expect(
      stack.previewUseCase.execute({ userId: user.userId, input: buildValidCeKey('000020004') }),
    ).rejects.toBeInstanceOf(SefazTemporarilyUnavailableError);
    expect(stubRequests).toHaveLength(6);

    const reopenedState = JSON.parse((await redisClient!.get(cbKey))!) as CircuitBreakerStateRecord;
    expect(reopenedState.state).toBe(CircuitBreakerStates.OPEN);
    expect(reopenedState.cooldownStage).toBe(1);

    await expireCircuitBreakerCooldownInRedis(redisClient!, cbKey);

    activeStubHandler = (req, res) => {
      const requestedKey = typeof req.body.chave_acesso === 'string' ? req.body.chave_acesso : FIXTURE_CANONICAL_KEY;
      const html = renderFixtureForKey('sefaz-ce-complete-with-discount-and-consumer.html', requestedKey);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ xml: html }));
    };

    const recoveryKey = buildValidCeKey('000020005');
    const recovered = await stack.previewUseCase.execute({ userId: user.userId, input: recoveryKey });
    expect(recovered.cacheHit).toBe(false);
    expect(recovered.fiscalNote.accessKey).toBe(recoveryKey);

    const closedState = JSON.parse((await redisClient!.get(cbKey))!) as CircuitBreakerStateRecord;
    expect(closedState.state).toBe(CircuitBreakerStates.CLOSED);
    expect(closedState.consecutiveFailures).toBe(0);
    expect(closedState.cooldownStage).toBe(0);

    await flushPendingAlerts();
    expect(alertSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        alertKey: FiscalNoteAlertKeys.sefazCircuitBreaker(FiscalNoteSupportedUfs.CE),
        event: FiscalNoteLogEvents.FISCAL_NOTE_SEFAZ_CB_CLOSED,
        severity: OperationalAlertSeverities.RESOLVED,
      }),
    );
  });

  it('releases HALF_OPEN probe lock when rate limiter rejects the probe so the next eligible user can probe immediately', async () => {
    const rateLimitedUser = await seedUserFixtures('cb-rl-user1');
    const openerUser = await seedUserFixtures('cb-rl-opener');
    const eligibleUser = await seedUserFixtures('cb-rl-user2');
    const stack = buildFiscalNoteStack({
      http: {
        timeoutMs: DEFAULT_FISCAL_NOTES_HTTP_TIMEOUT_MS,
        retryBackoffMs: 10,
        maxResponseBytes: DEFAULT_FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES,
      },
      rateLimit: {
        userPerMinute: 1,
        userPerHour: 10,
        globalPerMinute: 40,
      },
      circuitBreaker: {
        failureThreshold: 1,
        cooldownSeconds: [15, 45, 90],
      },
    });
    const cbKey = CacheKeys.fiscalNotes.circuitBreaker(FiscalNoteSupportedUfs.CE);
    const probeKey = `${cbKey}${CIRCUIT_BREAKER_PROBE_KEY_SUFFIX}`;

    await stack.previewUseCase.execute({
      userId: rateLimitedUser.userId,
      input: buildValidCeKey('000025001'),
    });

    activeStubHandler = (_req, res) => {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ erro: 'unavailable' }));
    };

    await expect(
      stack.previewUseCase.execute({
        userId: openerUser.userId,
        input: buildValidCeKey('000025002'),
      }),
    ).rejects.toBeInstanceOf(SefazTemporarilyUnavailableError);

    await expireCircuitBreakerCooldownInRedis(redisClient!, cbKey);

    await expect(
      stack.previewUseCase.execute({
        userId: rateLimitedUser.userId,
        input: buildValidCeKey('000025003'),
      }),
    ).rejects.toBeInstanceOf(FiscalNoteRateLimitExceededError);

    expect(await redisClient!.get(probeKey)).toBeNull();
    const stateAfterRejectedProbe = JSON.parse((await redisClient!.get(cbKey))!) as CircuitBreakerStateRecord;
    expect(stateAfterRejectedProbe.state).toBe(CircuitBreakerStates.OPEN);

    activeStubHandler = (req, res) => {
      const requestedKey = typeof req.body.chave_acesso === 'string' ? req.body.chave_acesso : FIXTURE_CANONICAL_KEY;
      const html = renderFixtureForKey('sefaz-ce-complete-with-discount-and-consumer.html', requestedKey);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ xml: html }));
    };

    const recovered = await stack.previewUseCase.execute({
      userId: eligibleUser.userId,
      input: buildValidCeKey('000025004'),
    });
    expect(recovered.cacheHit).toBe(false);

    const closedState = JSON.parse((await redisClient!.get(cbKey))!) as CircuitBreakerStateRecord;
    expect(closedState.state).toBe(CircuitBreakerStates.CLOSED);
  });

  it('atomically increments consecutiveFailures and opens CircuitBreaker once under concurrent recordFailure calls in real Redis', async () => {
    const cbKey = CacheKeys.fiscalNotes.circuitBreaker(FiscalNoteSupportedUfs.CE);
    const probeKey = `${cbKey}${CIRCUIT_BREAKER_PROBE_KEY_SUFFIX}`;
    await redisClient!.set(probeKey, '1', 'EX', 15);

    const opts = {
      key: cbKey,
      failureThreshold: 5,
      cooldownSeconds: [60, 120, 300],
    };

    const results = await Promise.all(Array.from({ length: 5 }, () => circuitBreakerService.recordFailure(opts)));

    expect(results.map(result => result.consecutiveFailures).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);

    const openedResults = results.filter(result => result.opened);
    expect(openedResults).toHaveLength(1);
    expect(openedResults[0]).toMatchObject({
      previousState: CircuitBreakerStates.CLOSED,
      currentState: CircuitBreakerStates.OPEN,
      opened: true,
      retryAfterSeconds: 60,
      consecutiveFailures: 5,
      cooldownStage: 0,
    });

    const persisted = JSON.parse((await redisClient!.get(cbKey))!) as CircuitBreakerStateRecord;
    expect(persisted.state).toBe(CircuitBreakerStates.OPEN);
    expect(persisted.consecutiveFailures).toBe(5);
    expect(persisted.cooldownStage).toBe(0);
    expect(await redisClient!.get(probeKey)).toBeNull();
  });

  it('validates HTTP client single retry on 503->200, 1MB streaming cap, 302 redirect block, and unknown QR host isolation', async () => {
    const user = await seedUserFixtures('http-client');
    const stack = buildFiscalNoteStack({
      http: {
        timeoutMs: DEFAULT_FISCAL_NOTES_HTTP_TIMEOUT_MS,
        retryBackoffMs: 10,
        maxResponseBytes: DEFAULT_FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES,
      },
    });

    const retryKey = buildValidCeKey('000030001');
    let retryAttempt = 0;
    activeStubHandler = (req, res) => {
      retryAttempt += 1;
      if (retryAttempt === 1) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ erro: 'temporary' }));
        return;
      }

      const requestedKey = typeof req.body.chave_acesso === 'string' ? req.body.chave_acesso : retryKey;
      const html = renderFixtureForKey('sefaz-ce-no-discount-no-gross.html', requestedKey);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ xml: html }));
    };

    const unknownHostUrl = `https://evil.attacker.example/nfce?p=${retryKey}|2|1|1|HASH`;
    const retryResult = await stack.previewUseCase.execute({ userId: user.userId, input: unknownHostUrl });
    expect(retryResult.fiscalNote.accessKey).toBe(retryKey);
    expect(stubRequests).toHaveLength(2);
    await flushPendingAlerts();
    expect(alertSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        alertKey: FiscalNoteAlertKeys.unknownQrHost(FiscalNoteSupportedUfs.CE),
        event: FiscalNoteLogEvents.FISCAL_NOTE_UNKNOWN_QR_HOST,
        severity: OperationalAlertSeverities.WARN,
      }),
    );

    stubRequests = [];
    activeStubHandler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const chunk = Buffer.alloc(262_144, 'a');
      for (let i = 0; i < 5; i += 1) {
        res.write(chunk);
      }
      res.end();
    };

    await expect(
      stack.previewUseCase.execute({ userId: user.userId, input: buildValidCeKey('000030002') }),
    ).rejects.toBeInstanceOf(FiscalNoteResponseTooLargeError);
    expect(stubRequests).toHaveLength(1);

    stubRequests = [];
    let redirectTargetCalled = false;
    activeStubHandler = (req, res) => {
      if (req.url === '/redirected-target') {
        redirectTargetCalled = true;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ xml: '<html></html>' }));
        return;
      }

      res.writeHead(302, { Location: `${stubBaseUrl}/redirected-target` });
      res.end();
    };

    await expect(
      stack.previewUseCase.execute({ userId: user.userId, input: buildValidCeKey('000030003') }),
    ).rejects.toBeInstanceOf(SefazTemporarilyUnavailableError);
    expect(redirectTargetCalled).toBe(false);
  });

  it('lists and gets fiscal notes with PostgreSQL filters, -03:00 boundaries, EXISTS search with LIKE escaping, sorting, pagination, and tenant isolation', async () => {
    const userA = await seedUserFixtures('list-a');
    const userB = await seedUserFixtures('list-b');
    const stack = buildFiscalNoteStack();

    async function seedNote(params: {
      id: string;
      user: UserFixtures;
      serial: string;
      sourceUf?: string;
      issuedAtIso: string;
      createdAtIso: string;
      issuerName: string;
      issuerCnpj: string;
      grossAmountCents: number;
      discountAmountCents: number;
      payableAmountCents: number;
      taxAmountCents: number;
      deletedAtIso?: string | null;
      itemDescriptions: string[];
    }): Promise<void> {
      const txId = randomUUID();
      const uf = params.sourceUf ?? FiscalNoteSupportedUfs.CE;
      const base43 = `${uf}2610${params.issuerCnpj}65103${params.serial.padStart(9, '0').slice(-9)}144320878`;
      const accessKey = computeMod11AccessKey(base43);

      await dataSource!.query(
        `INSERT INTO "transactions" ("id", "user_id", "account_id", "category_id", "type", "status", "amount_cents", "date", "effective_at")
         VALUES ($1, $2, $3, $4, 'EXPENSE', 'EFFECTIVE', $5, '2026-10-15', $6)`,
        [
          txId,
          params.user.userId,
          params.user.accountId,
          params.user.expenseCategoryId,
          String(params.payableAmountCents),
          params.issuedAtIso,
        ],
      );

      await dataSource!.query(
        `INSERT INTO "fiscal_notes" (
          "id", "user_id", "transaction_id", "access_key", "source_uf", "number", "series",
          "issued_at", "issuer_name", "issuer_cnpj", "gross_amount_cents", "discount_amount_cents",
          "payable_amount_cents", "tax_amount_cents", "parser_version", "created_at", "updated_at", "deleted_at"
        ) VALUES ($1, $2, $3, $4, $5, $6, '103', $7, $8, $9, $10, $11, $12, $13, $14, $15, $15, $16)`,
        [
          params.id,
          params.user.userId,
          txId,
          accessKey,
          uf,
          params.serial,
          params.issuedAtIso,
          params.issuerName,
          params.issuerCnpj,
          String(params.grossAmountCents),
          String(params.discountAmountCents),
          String(params.payableAmountCents),
          String(params.taxAmountCents),
          SEFAZ_CE_PARSER_VERSION,
          params.createdAtIso,
          params.deletedAtIso ?? null,
        ],
      );

      for (let index = 0; index < params.itemDescriptions.length; index += 1) {
        await dataSource!.query(
          `INSERT INTO "fiscal_note_items" (
            "fiscal_note_id", "position", "raw_description", "unit", "quantity", "unit_price", "total_price_cents"
          ) VALUES ($1, $2, $3, 'UN', '1.0000', '10.0000', $4)`,
          [params.id, index + 1, params.itemDescriptions[index], String(params.payableAmountCents)],
        );
      }

      await dataSource!.query(
        `INSERT INTO "fiscal_note_payments" ("fiscal_note_id", "position", "method_label", "amount_cents")
         VALUES ($1, 1, 'PIX', $2)`,
        [params.id, String(params.payableAmountCents)],
      );
    }

    const noteBeforeDay = '00000000-0000-4000-a000-000000000001';
    const noteBoundaryStartLowId = '00000000-0000-4000-a000-000000000002';
    const noteBoundaryStartHighId = '00000000-0000-4000-a000-000000000003';
    const noteBoundaryEnd = '00000000-0000-4000-a000-000000000004';
    const noteAfterDay = '00000000-0000-4000-a000-000000000005';
    const noteDeleted = '00000000-0000-4000-a000-000000000006';
    const noteUserB = '00000000-0000-4000-a000-000000000007';

    // 2026-10-14 23:30:00-03:00 -> 2026-10-15T02:30:00Z (previous civil day in -03:00!)
    await seedNote({
      id: noteBeforeDay,
      user: userA,
      serial: '100001',
      issuedAtIso: '2026-10-14T23:30:00-03:00',
      createdAtIso: '2026-10-15T03:00:00.000Z',
      issuerName: 'PADARIA DO BAIRRO',
      issuerCnpj: '11111111000111',
      grossAmountCents: 1500,
      discountAmountCents: 0,
      payableAmountCents: 1500,
      taxAmountCents: 100,
      itemDescriptions: ['PAO FRANCES 50% INTEGRAL', 'CAFE TORRADO'],
    });

    // Two notes with identical issuedAt & payableAmountCents to verify deterministic id tie-breaker
    await seedNote({
      id: noteBoundaryStartLowId,
      user: userA,
      serial: '100002',
      issuedAtIso: '2026-10-15T00:30:00-03:00',
      createdAtIso: '2026-10-15T04:00:00.000Z',
      issuerName: 'MERCADO CENTRAL LTDA',
      issuerCnpj: '22222222000122',
      grossAmountCents: 2500,
      discountAmountCents: 500,
      payableAmountCents: 2000,
      taxAmountCents: 200,
      itemDescriptions: ['LEITE INTEGRAL', 'QUEIJO COALHO', 'QUEIJO MUSSARELA'],
    });

    await seedNote({
      id: noteBoundaryStartHighId,
      user: userA,
      serial: '100003',
      issuedAtIso: '2026-10-15T00:30:00-03:00',
      createdAtIso: '2026-10-15T05:00:00.000Z',
      issuerName: 'FARMACIA A_B LTDA',
      issuerCnpj: '33333333000133',
      grossAmountCents: 2200,
      discountAmountCents: 200,
      payableAmountCents: 2000,
      taxAmountCents: 300,
      itemDescriptions: ['VITAMINA C', 'PROTETOR SOLAR'],
    });

    // 2026-10-15 23:30:00-03:00 -> 2026-10-16T02:30:00Z (still 2026-10-15 in -03:00!)
    await seedNote({
      id: noteBoundaryEnd,
      user: userA,
      serial: '100004',
      sourceUf: '35',
      issuedAtIso: '2026-10-15T23:30:00-03:00',
      createdAtIso: '2026-10-16T03:00:00.000Z',
      issuerName: 'LOJA X\\Y VARIEDADES',
      issuerCnpj: '22222222000122',
      grossAmountCents: 6000,
      discountAmountCents: 1000,
      payableAmountCents: 5000,
      taxAmountCents: 500,
      itemDescriptions: ['CABO USB', 'QUEIJO RALADO'],
    });

    // 2026-10-16 00:30:00-03:00 -> next civil day in -03:00
    await seedNote({
      id: noteAfterDay,
      user: userA,
      serial: '100005',
      issuedAtIso: '2026-10-16T00:30:00-03:00',
      createdAtIso: '2026-10-16T04:00:00.000Z',
      issuerName: 'RESTAURANTE SABOR',
      issuerCnpj: '44444444000144',
      grossAmountCents: 8000,
      discountAmountCents: 0,
      payableAmountCents: 8000,
      taxAmountCents: 800,
      itemDescriptions: ['ALMOCO EXECUTIVO'],
    });

    // Soft-deleted note for User A (must be excluded everywhere)
    await seedNote({
      id: noteDeleted,
      user: userA,
      serial: '100006',
      issuedAtIso: '2026-10-15T12:00:00-03:00',
      createdAtIso: '2026-10-15T15:00:00.000Z',
      issuerName: 'MERCADO DELETADO',
      issuerCnpj: '22222222000122',
      grossAmountCents: 9999,
      discountAmountCents: 0,
      payableAmountCents: 9999,
      taxAmountCents: 999,
      deletedAtIso: '2026-10-15T16:00:00.000Z',
      itemDescriptions: ['QUEIJO DELETADO'],
    });

    // User B note (must be isolated)
    await seedNote({
      id: noteUserB,
      user: userB,
      serial: '100007',
      issuedAtIso: '2026-10-15T12:00:00-03:00',
      createdAtIso: '2026-10-15T15:00:00.000Z',
      issuerName: 'MERCADO OUTRO USUARIO',
      issuerCnpj: '22222222000122',
      grossAmountCents: 7777,
      discountAmountCents: 0,
      payableAmountCents: 7777,
      taxAmountCents: 777,
      itemDescriptions: ['QUEIJO USUARIO B'],
    });

    // 1. Pagination + default sort (issuedAt:desc, id:desc) + soft-delete & multi-tenant exclusion
    const page1 = await stack.listFiscalNotesUseCase.execute({
      userId: userA.userId,
      page: 1,
      limit: 2,
    });
    expect(page1.total).toBe(5);
    expect(page1.totalPages).toBe(3);
    expect(page1.hasNextPage).toBe(true);
    expect(page1.hasPreviousPage).toBe(false);
    expect(page1.items.map(item => item.id)).toEqual([noteAfterDay, noteBoundaryEnd]);
    expect(page1.summary).toEqual({
      totalNotes: 5,
      totalGrossAmountCents: 20200,
      totalDiscountAmountCents: 1700,
      totalPayableAmountCents: 18500,
      totalTaxAmountCents: 1900,
    });

    // Out-of-range page skips data query while preserving total and summary
    const pageOut = await stack.listFiscalNotesUseCase.execute({
      userId: userA.userId,
      page: 10,
      limit: 2,
    });
    expect(pageOut.items).toEqual([]);
    expect(pageOut.total).toBe(5);
    expect(pageOut.totalPages).toBe(3);
    expect(pageOut.hasNextPage).toBe(false);
    expect(pageOut.hasPreviousPage).toBe(true);
    expect(pageOut.summary).toEqual(page1.summary);

    // 2. All 6 sort modes + deterministic tie-breaking on id
    const issuedAsc = await stack.listFiscalNotesUseCase.execute({
      userId: userA.userId,
      sort: FiscalNoteListSorts.ISSUED_AT_ASC,
    });
    expect(issuedAsc.items.map(item => item.id)).toEqual([
      noteBeforeDay,
      noteBoundaryStartLowId,
      noteBoundaryStartHighId,
      noteBoundaryEnd,
      noteAfterDay,
    ]);

    const issuedDesc = await stack.listFiscalNotesUseCase.execute({
      userId: userA.userId,
      sort: FiscalNoteListSorts.ISSUED_AT_DESC,
    });
    expect(issuedDesc.items.map(item => item.id)).toEqual([
      noteAfterDay,
      noteBoundaryEnd,
      noteBoundaryStartHighId,
      noteBoundaryStartLowId,
      noteBeforeDay,
    ]);

    const payableDesc = await stack.listFiscalNotesUseCase.execute({
      userId: userA.userId,
      sort: FiscalNoteListSorts.PAYABLE_AMOUNT_DESC,
    });
    expect(payableDesc.items.map(item => item.id)).toEqual([
      noteAfterDay,
      noteBoundaryEnd,
      noteBoundaryStartHighId,
      noteBoundaryStartLowId,
      noteBeforeDay,
    ]);

    const payableAsc = await stack.listFiscalNotesUseCase.execute({
      userId: userA.userId,
      sort: FiscalNoteListSorts.PAYABLE_AMOUNT_ASC,
    });
    expect(payableAsc.items.map(item => item.id)).toEqual([
      noteBeforeDay,
      noteBoundaryStartLowId,
      noteBoundaryStartHighId,
      noteBoundaryEnd,
      noteAfterDay,
    ]);

    const createdDesc = await stack.listFiscalNotesUseCase.execute({
      userId: userA.userId,
      sort: FiscalNoteListSorts.CREATED_AT_DESC,
    });
    expect(createdDesc.items.map(item => item.id)).toEqual([
      noteAfterDay,
      noteBoundaryEnd,
      noteBoundaryStartHighId,
      noteBoundaryStartLowId,
      noteBeforeDay,
    ]);

    const createdAsc = await stack.listFiscalNotesUseCase.execute({
      userId: userA.userId,
      sort: FiscalNoteListSorts.CREATED_AT_ASC,
    });
    expect(createdAsc.items.map(item => item.id)).toEqual([
      noteBeforeDay,
      noteBoundaryStartLowId,
      noteBoundaryStartHighId,
      noteBoundaryEnd,
      noteAfterDay,
    ]);

    // 3. Civil-date -03:00 boundary filtering (issuedFrom / issuedTo)
    const dayRange = await stack.listFiscalNotesUseCase.execute({
      userId: userA.userId,
      issuedFrom: toDateOnly('2026-10-15'),
      issuedTo: toDateOnly('2026-10-15'),
      sort: FiscalNoteListSorts.ISSUED_AT_ASC,
    });
    expect(dayRange.items.map(item => item.id)).toEqual([
      noteBoundaryStartLowId,
      noteBoundaryStartHighId,
      noteBoundaryEnd,
    ]);
    expect(dayRange.total).toBe(3);

    // 4. Structured filters: issuerCnpj, sourceUf, minAmountCents, maxAmountCents
    const filteredCnpjUfAmount = await stack.listFiscalNotesUseCase.execute({
      userId: userA.userId,
      issuerCnpj: '22222222000122',
      sourceUf: '35',
      minAmountCents: 4000,
      maxAmountCents: 6000,
    });
    expect(filteredCnpjUfAmount.items.map(item => item.id)).toEqual([noteBoundaryEnd]);

    // 5. Case-insensitive search on issuer_name
    const byIssuerName = await stack.listFiscalNotesUseCase.execute({
      userId: userA.userId,
      search: 'mercado central',
    });
    expect(byIssuerName.items.map(item => item.id)).toEqual([noteBoundaryStartLowId]);

    // 6. Search matching multiple items in one note -> zero row duplication & zero double counting + accurate itemsCount
    const byItemMultiMatch = await stack.listFiscalNotesUseCase.execute({
      userId: userA.userId,
      search: 'queijo',
      sort: FiscalNoteListSorts.ISSUED_AT_ASC,
    });
    expect(byItemMultiMatch.items.map(item => item.id)).toEqual([noteBoundaryStartLowId, noteBoundaryEnd]);
    expect(byItemMultiMatch.total).toBe(2);
    expect(byItemMultiMatch.items[0].itemsCount).toBe(3);
    expect(byItemMultiMatch.items[1].itemsCount).toBe(2);
    expect(byItemMultiMatch.summary).toEqual({
      totalNotes: 2,
      totalGrossAmountCents: 8500,
      totalDiscountAmountCents: 1500,
      totalPayableAmountCents: 7000,
      totalTaxAmountCents: 700,
    });

    // 7. LIKE wildcard escaping for %, _, and \
    const searchPercent = await stack.listFiscalNotesUseCase.execute({
      userId: userA.userId,
      search: '%',
    });
    expect(searchPercent.items.map(item => item.id)).toEqual([noteBeforeDay]);

    const searchUnderscore = await stack.listFiscalNotesUseCase.execute({
      userId: userA.userId,
      search: 'A_B',
    });
    expect(searchUnderscore.items.map(item => item.id)).toEqual([noteBoundaryStartHighId]);

    const searchBackslash = await stack.listFiscalNotesUseCase.execute({
      userId: userA.userId,
      search: 'X\\Y',
    });
    expect(searchBackslash.items.map(item => item.id)).toEqual([noteBoundaryEnd]);

    // 8. GetFiscalNoteUseCase: returns active note for owner, throws 404 for deleted or other user's note
    const loadedNote = await stack.getFiscalNoteByIdUseCase.execute({
      userId: userA.userId,
      fiscalNoteId: noteBoundaryStartLowId,
    });
    expect(loadedNote.id).toBe(noteBoundaryStartLowId);
    expect(loadedNote.items).toHaveLength(3);
    expect(loadedNote.payments).toHaveLength(1);

    await expect(
      stack.getFiscalNoteByIdUseCase.execute({
        userId: userA.userId,
        fiscalNoteId: noteDeleted,
      }),
    ).rejects.toBeInstanceOf(FiscalNoteNotFoundError);

    await expect(
      stack.getFiscalNoteByIdUseCase.execute({
        userId: userA.userId,
        fiscalNoteId: noteUserB,
      }),
    ).rejects.toBeInstanceOf(FiscalNoteNotFoundError);

    const listUserB = await stack.listFiscalNotesUseCase.execute({ userId: userB.userId });
    expect(listUserB.items.map(item => item.id)).toEqual([noteUserB]);
  });
});

async function expireCircuitBreakerCooldownInRedis(redisClient: Redis, cbKey: string): Promise<void> {
  const raw = await redisClient.get(cbKey);
  if (!raw) {
    throw new Error(`Expected circuit breaker key ${cbKey} to exist in Redis.`);
  }

  const record = JSON.parse(raw) as CircuitBreakerStateRecord;
  const expiredRecord: CircuitBreakerStateRecord = {
    ...record,
    nextAttemptAtMs: Date.now() - 1000,
  };
  await redisClient.set(cbKey, JSON.stringify(expiredRecord), 'EX', 300);
}
