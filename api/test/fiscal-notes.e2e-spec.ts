import { IS_PUBLIC_KEY } from '@/common/decorators/is-public.decorator';
import { Email } from '@/common/domain/value-objects/email.value-object';
import { AppExceptionFilter } from '@/common/filters';
import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { TransactionStatus, TransactionType, UserStatus } from '@/common/models/enums';
import { toDateOnly } from '@/common/utils/date-only';
import { createValidationException } from '@/common/validation';
import {
  FiscalNoteAlreadyImportedError,
  FiscalNoteCancelledOrDeniedError,
  FiscalNoteNotFoundError,
  FiscalNoteParseFailedError,
  FiscalNoteRateLimitExceededError,
  FiscalNoteResponseTooLargeError,
  FiscalNoteSefazNotFoundError,
  SefazTemporarilyUnavailableError,
  SefazTimeoutError,
  TransactionAlreadyHasFiscalNoteError,
} from '@/modules/fiscal-notes/application/errors';
import { ParsedFiscalNoteData } from '@/modules/fiscal-notes/application/ports';
import { GetTransactionFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/get-transaction-fiscal-note/get-transaction-fiscal-note.use-case';
import { ImportFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/import-fiscal-note/import-fiscal-note.use-case';
import { LinkFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/link-fiscal-note/link-fiscal-note.use-case';
import { PreviewFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/preview-fiscal-note/preview-fiscal-note.use-case';
import { UnlinkTransactionFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/unlink-transaction-fiscal-note/unlink-transaction-fiscal-note.use-case';
import {
  FiscalNoteErrorCodes,
  FiscalNoteSupportedUfs,
  SEFAZ_CE_PARSER_VERSION,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import {
  FiscalNoteHomologationNotAllowedError,
  FiscalNoteInvalidInputError,
  FiscalNoteUnsupportedUfError,
} from '@/modules/fiscal-notes/domain/errors';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import { FiscalNoteItem } from '@/modules/fiscal-notes/domain/entities/fiscal-note-item.entity';
import { FiscalNotePayment } from '@/modules/fiscal-notes/domain/entities/fiscal-note-payment.entity';
import { FiscalNotesController } from '@/modules/fiscal-notes/presentation/http/fiscal-notes.controller';
import { TransactionFiscalNoteController } from '@/modules/fiscal-notes/presentation/http/transaction-fiscal-note.controller';
import { HealthController } from '@/modules/health/health.controller';
import { RedisHealthIndicator } from '@/modules/health/indicators/redis-health-indicator';
import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import { ConfirmTransactionUseCase } from '@/modules/transactions/application/use-cases/confirm-transaction/confirm-transaction.use-case';
import { CreateBalanceAdjustmentUseCase } from '@/modules/transactions/application/use-cases/create-balance-adjustment/create-balance-adjustment.use-case';
import { CreateTransactionUseCase } from '@/modules/transactions/application/use-cases/create-transaction/create-transaction.use-case';
import { DeleteTransactionUseCase } from '@/modules/transactions/application/use-cases/delete-transaction/delete-transaction.use-case';
import { GetTransactionUseCase } from '@/modules/transactions/application/use-cases/get-transaction/get-transaction.use-case';
import { ListTransactionsUseCase } from '@/modules/transactions/application/use-cases/list-transactions/list-transactions.use-case';
import { UpdateTransactionUseCase } from '@/modules/transactions/application/use-cases/update-transaction/update-transaction.use-case';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import {
  TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE_CODE,
  TransactionTypeDoesNotSupportFiscalNoteError,
} from '@/modules/transactions/domain/errors';
import { TransactionsController } from '@/modules/transactions/presentation/http/transactions.controller';
import { User } from '@/modules/users/domain/entities/user.entity';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HealthCheckService, MemoryHealthIndicator, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

const TEST_BEARER_TOKEN = 'Bearer fiscal-notes-e2e-token';
const TEST_USER_ID = '11111111-1111-4111-a111-111111111111';
const TEST_ACCOUNT_ID = '22222222-2222-4222-a222-222222222222';
const TEST_CATEGORY_ID = '33333333-3333-4333-a333-333333333333';
const TEST_TRANSACTION_ID = '44444444-4444-4444-a444-444444444444';
const TEST_FISCAL_NOTE_ID = '55555555-5555-4555-a555-555555555555';
const VALID_CE_ACCESS_KEY = '23261003539462000250651030000760541443208780';
const VALID_CE_QR_URL = `http://nfce.sefaz.ce.gov.br/nfce/pagina?p=${VALID_CE_ACCESS_KEY}|2|1|1|HASH123`;

@Injectable()
class TestSessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const httpRequest = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: User;
    }>();

    if (httpRequest.headers.authorization !== TEST_BEARER_TOKEN) {
      throw new UnauthorizedException('Session is missing or invalid.');
    }

    const now = new Date('2026-10-01T00:00:00.000Z');
    httpRequest.user = User.reconstitute(
      {
        userName: null,
        firstName: 'Fiscal',
        lastName: 'User',
        email: Email.reconstitute('fiscal-e2e@example.com'),
        status: UserStatus.ACTIVE,
        avatarAssetId: null,
        authProviders: [],
        credentialVersion: 1,
        createdAt: now,
        updatedAt: now,
      },
      TEST_USER_ID,
    );

    return true;
  }
}

function buildParsedFiscalNoteData(): ParsedFiscalNoteData {
  return {
    accessKey: VALID_CE_ACCESS_KEY,
    sourceUf: FiscalNoteSupportedUfs.CE,
    number: '76054',
    series: '103',
    issuedAt: new Date('2026-10-16T01:15:30.000Z'),
    issuedDate: toDateOnly('2026-10-15'),
    protocol: '223260123456789',
    issuerName: 'SUPERMERCADO EXEMPLO FORTALEZA LTDA',
    issuerCnpj: '03539462000250',
    issuerAddress: 'AV BEZERRA DE MENEZES, 1000, FORTALEZA, CE',
    grossAmountCents: 4013,
    discountAmountCents: 872,
    payableAmountCents: 3141,
    taxAmountCents: 1051,
    changeAmountCents: null,
    xmlVersion: '4.00',
    xsltVersion: '2.05',
    parserVersion: SEFAZ_CE_PARSER_VERSION,
    items: [
      {
        position: 1,
        rawDescription: 'QUEIJO MUSSARELA FATIADO',
        storeCode: '1001',
        unit: 'KG',
        quantity: 0.468,
        unitPrice: 26.99,
        totalPriceCents: 1263,
      },
      {
        position: 2,
        rawDescription: 'CAFE TORRADO E MOIDO 500G',
        storeCode: '2002',
        unit: 'UN',
        quantity: 1,
        unitPrice: 18.78,
        totalPriceCents: 1878,
      },
    ],
    payments: [
      {
        position: 1,
        methodLabel: 'Cartão de Débito',
        amountCents: 3141,
      },
    ],
  };
}

function buildDomainFiscalNote(transactionId = TEST_TRANSACTION_ID, noteId = TEST_FISCAL_NOTE_ID): FiscalNote {
  const now = new Date('2026-10-16T01:20:00.000Z');
  return FiscalNote.create(
    {
      id: noteId,
      userId: TEST_USER_ID,
      transactionId,
      accessKey: VALID_CE_ACCESS_KEY,
      sourceUf: FiscalNoteSupportedUfs.CE,
      number: '76054',
      series: '103',
      issuedAt: new Date('2026-10-16T01:15:30.000Z'),
      protocol: '223260123456789',
      issuerName: 'SUPERMERCADO EXEMPLO FORTALEZA LTDA',
      issuerCnpj: '03539462000250',
      issuerAddress: 'AV BEZERRA DE MENEZES, 1000, FORTALEZA, CE',
      grossAmountCents: 4013,
      discountAmountCents: 872,
      payableAmountCents: 3141,
      taxAmountCents: 1051,
      changeAmountCents: null,
      xmlVersion: '4.00',
      xsltVersion: '2.05',
      parserVersion: SEFAZ_CE_PARSER_VERSION,
      items: [
        FiscalNoteItem.create({
          fiscalNoteId: noteId,
          position: 1,
          rawDescription: 'QUEIJO MUSSARELA FATIADO',
          storeCode: '1001',
          unit: 'KG',
          quantity: 0.468,
          unitPrice: 26.99,
          totalPriceCents: 1263,
          createdAt: now,
        }),
      ],
      payments: [
        FiscalNotePayment.create({
          fiscalNoteId: noteId,
          position: 1,
          methodLabel: 'Cartão de Débito',
          amountCents: 3141,
          createdAt: now,
        }),
      ],
      createdAt: now,
      updatedAt: now,
    },
    noteId,
  );
}

function buildDomainTransaction(hasFiscalNote: boolean, id = TEST_TRANSACTION_ID): Transaction {
  const now = new Date('2026-10-16T01:20:00.000Z');
  const transaction = Transaction.create(
    {
      userId: TEST_USER_ID,
      accountId: TEST_ACCOUNT_ID,
      destinationAccountId: null,
      categoryId: TEST_CATEGORY_ID,
      type: TransactionType.EXPENSE,
      status: TransactionStatus.EFFECTIVE,
      amountCents: 3141,
      date: toDateOnly('2026-10-15'),
      effectiveAt: new Date('2026-10-16T01:15:30.000Z'),
      description: 'SUPERMERCADO EXEMPLO FORTALEZA LTDA',
      direction: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    id,
  );
  transaction.setHasFiscalNote(hasFiscalNote);
  return transaction;
}

describe('Fiscal notes HTTP contract (e2e)', () => {
  let app: INestApplication;

  const previewExecute = jest.fn<
    ReturnType<PreviewFiscalNoteUseCase['execute']>,
    Parameters<PreviewFiscalNoteUseCase['execute']>
  >();
  const importExecute = jest.fn<
    ReturnType<ImportFiscalNoteUseCase['execute']>,
    Parameters<ImportFiscalNoteUseCase['execute']>
  >();
  const linkExecute = jest.fn<
    ReturnType<LinkFiscalNoteUseCase['execute']>,
    Parameters<LinkFiscalNoteUseCase['execute']>
  >();
  const getFiscalNoteExecute = jest.fn<
    ReturnType<GetTransactionFiscalNoteUseCase['execute']>,
    Parameters<GetTransactionFiscalNoteUseCase['execute']>
  >();
  const unlinkFiscalNoteExecute = jest.fn<
    ReturnType<UnlinkTransactionFiscalNoteUseCase['execute']>,
    Parameters<UnlinkTransactionFiscalNoteUseCase['execute']>
  >();
  const listTransactionsExecute = jest.fn<
    ReturnType<ListTransactionsUseCase['execute']>,
    Parameters<ListTransactionsUseCase['execute']>
  >();
  const getTransactionExecute = jest.fn<
    ReturnType<GetTransactionUseCase['execute']>,
    Parameters<GetTransactionUseCase['execute']>
  >();
  const updateTransactionExecute = jest.fn<
    ReturnType<UpdateTransactionUseCase['execute']>,
    Parameters<UpdateTransactionUseCase['execute']>
  >();
  const confirmTransactionExecute = jest.fn<
    ReturnType<ConfirmTransactionUseCase['execute']>,
    Parameters<ConfirmTransactionUseCase['execute']>
  >();

  const healthCheckExecute = jest.fn();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [FiscalNotesController, TransactionFiscalNoteController, TransactionsController, HealthController],
      providers: [
        { provide: PreviewFiscalNoteUseCase, useValue: { execute: previewExecute } },
        { provide: ImportFiscalNoteUseCase, useValue: { execute: importExecute } },
        { provide: LinkFiscalNoteUseCase, useValue: { execute: linkExecute } },
        { provide: GetTransactionFiscalNoteUseCase, useValue: { execute: getFiscalNoteExecute } },
        { provide: UnlinkTransactionFiscalNoteUseCase, useValue: { execute: unlinkFiscalNoteExecute } },
        { provide: CreateTransactionUseCase, useValue: { execute: jest.fn() } },
        { provide: CreateBalanceAdjustmentUseCase, useValue: { execute: jest.fn() } },
        { provide: ListTransactionsUseCase, useValue: { execute: listTransactionsExecute } },
        { provide: GetTransactionUseCase, useValue: { execute: getTransactionExecute } },
        { provide: UpdateTransactionUseCase, useValue: { execute: updateTransactionExecute } },
        { provide: ConfirmTransactionUseCase, useValue: { execute: confirmTransactionExecute } },
        { provide: DeleteTransactionUseCase, useValue: { execute: jest.fn() } },
        { provide: HealthCheckService, useValue: { check: healthCheckExecute } },
        { provide: TypeOrmHealthIndicator, useValue: { pingCheck: jest.fn() } },
        { provide: MemoryHealthIndicator, useValue: { checkHeap: jest.fn() } },
        { provide: RedisHealthIndicator, useValue: { isHealthy: jest.fn() } },
        { provide: APP_GUARD, useClass: TestSessionGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AppExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: createValidationException,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    healthCheckExecute.mockResolvedValue({
      status: 'ok',
      info: {},
      error: {},
      details: {},
    });
  });

  const getServer = (): Parameters<typeof request>[0] => app.getHttpServer() as Parameters<typeof request>[0];

  describe('Authentication guard boundary', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const response = await request(getServer())
        .post('/fiscal-notes/preview')
        .send({ input: VALID_CE_QR_URL })
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        path: '/fiscal-notes/preview',
      });
      expect(previewExecute).not.toHaveBeenCalled();
    });
  });

  describe('POST /fiscal-notes/preview', () => {
    it('returns 200 OK with fiscal_note.preview contract, items, payments, and zero consumer PII or raw HTML', async () => {
      const parsed = buildParsedFiscalNoteData();
      previewExecute.mockResolvedValueOnce({
        alreadyImported: false,
        existingTransactionId: null,
        existingFiscalNoteId: null,
        cacheHit: false,
        suggestedTransaction: {
          type: TransactionType.EXPENSE,
          status: TransactionStatus.EFFECTIVE,
          amountCents: parsed.payableAmountCents,
          date: parsed.issuedDate,
          description: parsed.issuerName,
        },
        fiscalNote: parsed,
      });

      const response = await request(getServer())
        .post('/fiscal-notes/preview')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({ input: VALID_CE_QR_URL })
        .expect(200);

      expect(previewExecute).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        input: VALID_CE_QR_URL,
      });
      expect(response.body).toEqual({
        object: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_PREVIEW,
        alreadyImported: false,
        existingTransactionId: null,
        existingFiscalNoteId: null,
        cacheHit: false,
        suggestedTransaction: {
          type: TransactionType.EXPENSE,
          status: TransactionStatus.EFFECTIVE,
          amountCents: 3141,
          date: '2026-10-15',
          description: 'SUPERMERCADO EXEMPLO FORTALEZA LTDA',
        },
        fiscalNote: {
          accessKey: VALID_CE_ACCESS_KEY,
          sourceUf: FiscalNoteSupportedUfs.CE,
          number: '76054',
          series: '103',
          issuedAt: '2026-10-16T01:15:30.000Z',
          issuedDate: '2026-10-15',
          protocol: '223260123456789',
          issuerName: 'SUPERMERCADO EXEMPLO FORTALEZA LTDA',
          issuerCnpj: '03539462000250',
          issuerAddress: 'AV BEZERRA DE MENEZES, 1000, FORTALEZA, CE',
          grossAmountCents: 4013,
          discountAmountCents: 872,
          payableAmountCents: 3141,
          taxAmountCents: 1051,
          changeAmountCents: null,
          xmlVersion: '4.00',
          xsltVersion: '2.05',
          parserVersion: SEFAZ_CE_PARSER_VERSION,
          items: parsed.items,
          payments: parsed.payments,
        },
      });

      const serialized = JSON.stringify(response.body).toLowerCase();
      expect(serialized).not.toContain('consumidor');
      expect(serialized).not.toContain('cpf');
      expect(serialized).not.toContain('<html');
      expect(serialized).not.toContain('<table');
    });

    it('returns cacheHit: true and existing import metadata when cached and already imported', async () => {
      const parsed = buildParsedFiscalNoteData();
      previewExecute.mockResolvedValueOnce({
        alreadyImported: true,
        existingTransactionId: TEST_TRANSACTION_ID,
        existingFiscalNoteId: TEST_FISCAL_NOTE_ID,
        cacheHit: true,
        suggestedTransaction: {
          type: TransactionType.EXPENSE,
          status: TransactionStatus.EFFECTIVE,
          amountCents: parsed.payableAmountCents,
          date: parsed.issuedDate,
          description: parsed.issuerName,
        },
        fiscalNote: parsed,
      });

      const response = await request(getServer())
        .post('/fiscal-notes/preview')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({ input: VALID_CE_ACCESS_KEY })
        .expect(200);

      expect(response.body).toMatchObject({
        object: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_PREVIEW,
        alreadyImported: true,
        existingTransactionId: TEST_TRANSACTION_ID,
        existingFiscalNoteId: TEST_FISCAL_NOTE_ID,
        cacheHit: true,
      });
    });

    it('returns 400 Bad Request for empty payload, extra whitelisted field, or FISCAL_NOTE_INVALID_INPUT', async () => {
      const emptyRes = await request(getServer())
        .post('/fiscal-notes/preview')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({})
        .expect(400);
      expect(emptyRes.body).toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });

      const extraFieldRes = await request(getServer())
        .post('/fiscal-notes/preview')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({ input: VALID_CE_ACCESS_KEY, userId: TEST_USER_ID })
        .expect(400);
      expect(extraFieldRes.body).toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
      expect(previewExecute).not.toHaveBeenCalled();

      previewExecute.mockRejectedValueOnce(new FiscalNoteInvalidInputError());
      const invalidInputRes = await request(getServer())
        .post('/fiscal-notes/preview')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({ input: 'chave-invalida' })
        .expect(400);
      expect(invalidInputRes.body).toMatchObject({
        statusCode: 400,
        code: FiscalNoteErrorCodes.FISCAL_NOTE_INVALID_INPUT,
        details: null,
      });
    });

    it('returns 404 Not Found for FISCAL_NOTE_SEFAZ_NOT_FOUND', async () => {
      previewExecute.mockRejectedValueOnce(new FiscalNoteSefazNotFoundError());

      const response = await request(getServer())
        .post('/fiscal-notes/preview')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({ input: VALID_CE_ACCESS_KEY })
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        code: FiscalNoteErrorCodes.FISCAL_NOTE_SEFAZ_NOT_FOUND,
      });
    });

    it('returns 422 Unprocessable Entity for unsupported UF, homologation, and cancelled/denied notes', async () => {
      const cases = [
        {
          error: new FiscalNoteUnsupportedUfError('35'),
          expectedCode: FiscalNoteErrorCodes.FISCAL_NOTE_UNSUPPORTED_UF,
        },
        {
          error: new FiscalNoteHomologationNotAllowedError(),
          expectedCode: FiscalNoteErrorCodes.FISCAL_NOTE_HOMOLOGATION_NOT_ALLOWED,
        },
        {
          error: new FiscalNoteCancelledOrDeniedError(),
          expectedCode: FiscalNoteErrorCodes.FISCAL_NOTE_CANCELLED_OR_DENIED,
        },
      ];

      for (const testCase of cases) {
        previewExecute.mockRejectedValueOnce(testCase.error);

        const response = await request(getServer())
          .post('/fiscal-notes/preview')
          .set('Authorization', TEST_BEARER_TOKEN)
          .send({ input: VALID_CE_QR_URL })
          .expect(422);

        expect(response.body).toMatchObject({
          statusCode: 422,
          code: testCase.expectedCode,
          details: null,
        });
      }
    });

    it('returns 429 Too Many Requests with Retry-After header and details.retryAfterSeconds', async () => {
      previewExecute.mockRejectedValueOnce(new FiscalNoteRateLimitExceededError(42));

      const response = await request(getServer())
        .post('/fiscal-notes/preview')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({ input: VALID_CE_QR_URL })
        .expect(429);

      expect(response.headers['retry-after']).toBe('42');
      expect(response.body).toMatchObject({
        statusCode: 429,
        code: FiscalNoteErrorCodes.FISCAL_NOTE_RATE_LIMIT_EXCEEDED,
        details: {
          retryAfterSeconds: 42,
        },
      });
    });

    it('returns 503 Service Unavailable with Retry-After header when SEFAZ is temporarily unavailable', async () => {
      previewExecute.mockRejectedValueOnce(new SefazTemporarilyUnavailableError(65));

      const response = await request(getServer())
        .post('/fiscal-notes/preview')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({ input: VALID_CE_QR_URL })
        .expect(503);

      expect(response.headers['retry-after']).toBe('65');
      expect(response.body).toMatchObject({
        statusCode: 503,
        code: FiscalNoteErrorCodes.SEFAZ_TEMPORARILY_UNAVAILABLE,
        details: {
          retryAfterSeconds: 65,
        },
      });
    });

    it('returns 504 Gateway Timeout for SEFAZ_TIMEOUT and 502 Bad Gateway for parse/size errors', async () => {
      previewExecute.mockRejectedValueOnce(new SefazTimeoutError());
      const timeoutRes = await request(getServer())
        .post('/fiscal-notes/preview')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({ input: VALID_CE_QR_URL })
        .expect(504);
      expect(timeoutRes.body).toMatchObject({
        statusCode: 504,
        code: FiscalNoteErrorCodes.SEFAZ_TIMEOUT,
      });

      previewExecute.mockRejectedValueOnce(new FiscalNoteParseFailedError());
      const parseRes = await request(getServer())
        .post('/fiscal-notes/preview')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({ input: VALID_CE_QR_URL })
        .expect(502);
      expect(parseRes.body).toMatchObject({
        statusCode: 502,
        code: FiscalNoteErrorCodes.FISCAL_NOTE_PARSE_FAILED,
      });

      previewExecute.mockRejectedValueOnce(new FiscalNoteResponseTooLargeError());
      const sizeRes = await request(getServer())
        .post('/fiscal-notes/preview')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({ input: VALID_CE_QR_URL })
        .expect(502);
      expect(sizeRes.body).toMatchObject({
        statusCode: 502,
        code: FiscalNoteErrorCodes.FISCAL_NOTE_RESPONSE_TOO_LARGE,
      });
    });
  });

  describe('POST /fiscal-notes/import', () => {
    it('returns 201 Created with fiscal_note.import, transaction.hasFiscalNote: true, and fiscalNote items/payments', async () => {
      const transaction = buildDomainTransaction(true);
      const fiscalNote = buildDomainFiscalNote();
      importExecute.mockResolvedValueOnce({ transaction, fiscalNote });

      const response = await request(getServer())
        .post('/fiscal-notes/import')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({
          input: VALID_CE_QR_URL,
          accountId: TEST_ACCOUNT_ID,
          categoryId: TEST_CATEGORY_ID,
        })
        .expect(201);

      expect(importExecute).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        input: VALID_CE_QR_URL,
        accountId: TEST_ACCOUNT_ID,
        categoryId: TEST_CATEGORY_ID,
      });
      expect(response.body).toMatchObject({
        object: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_IMPORT,
        transaction: {
          id: TEST_TRANSACTION_ID,
          type: TransactionType.EXPENSE,
          hasFiscalNote: true,
          amountCents: 3141,
        },
        fiscalNote: {
          object: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_ITEM,
          id: TEST_FISCAL_NOTE_ID,
          transactionId: TEST_TRANSACTION_ID,
          accessKey: VALID_CE_ACCESS_KEY,
          items: [
            {
              position: 1,
              rawDescription: 'QUEIJO MUSSARELA FATIADO',
              totalPriceCents: 1263,
            },
          ],
          payments: [
            {
              position: 1,
              methodLabel: 'Cartão de Débito',
              amountCents: 3141,
            },
          ],
        },
      });
    });

    it('returns 400 Bad Request when accountId, categoryId, or input is missing or invalid', async () => {
      await request(getServer())
        .post('/fiscal-notes/import')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({
          accountId: TEST_ACCOUNT_ID,
          categoryId: TEST_CATEGORY_ID,
        })
        .expect(400);

      await request(getServer())
        .post('/fiscal-notes/import')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({
          input: VALID_CE_QR_URL,
          accountId: 'not-a-uuid',
          categoryId: TEST_CATEGORY_ID,
        })
        .expect(400);

      await request(getServer())
        .post('/fiscal-notes/import')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({
          input: VALID_CE_QR_URL,
          accountId: TEST_ACCOUNT_ID,
          categoryId: 'not-a-uuid',
        })
        .expect(400);

      await request(getServer())
        .post('/fiscal-notes/import')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({
          input: VALID_CE_QR_URL,
          accountId: TEST_ACCOUNT_ID,
        })
        .expect(400);

      await request(getServer())
        .post('/fiscal-notes/import')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({
          input: VALID_CE_QR_URL,
          categoryId: TEST_CATEGORY_ID,
        })
        .expect(400);

      for (const disallowedField of [
        { type: TransactionType.EXPENSE },
        { destinationAccountId: TEST_ACCOUNT_ID },
        { direction: 'INCREASE' },
      ]) {
        await request(getServer())
          .post('/fiscal-notes/import')
          .set('Authorization', TEST_BEARER_TOKEN)
          .send({
            input: VALID_CE_QR_URL,
            accountId: TEST_ACCOUNT_ID,
            categoryId: TEST_CATEGORY_ID,
            ...disallowedField,
          })
          .expect(400);
      }

      for (const nullOverride of [{ amountCents: null }, { date: null }, { status: null }]) {
        await request(getServer())
          .post('/fiscal-notes/import')
          .set('Authorization', TEST_BEARER_TOKEN)
          .send({
            input: VALID_CE_QR_URL,
            accountId: TEST_ACCOUNT_ID,
            categoryId: TEST_CATEGORY_ID,
            ...nullOverride,
          })
          .expect(400);
      }

      expect(importExecute).not.toHaveBeenCalled();
    });

    it('builds valid Swagger schema for ImportFiscalNoteDto derived from CreateTransactionDto', () => {
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle('Test').setVersion('1.0').build(),
      );
      const schema = document.components?.schemas?.ImportFiscalNoteDto as
        | { properties?: Record<string, unknown>; required?: string[] }
        | undefined;

      expect(schema).toBeDefined();
      expect(Object.keys(schema?.properties ?? {})).toEqual(
        expect.arrayContaining(['input', 'accountId', 'categoryId', 'amountCents', 'date', 'description', 'status']),
      );
      expect(schema?.properties).not.toHaveProperty('type');
      expect(schema?.properties).not.toHaveProperty('destinationAccountId');
      expect(schema?.properties).not.toHaveProperty('direction');
      expect(schema?.required).toEqual(expect.arrayContaining(['input', 'accountId', 'categoryId']));
      expect(schema?.required).not.toContain('amountCents');
      expect(schema?.required).not.toContain('date');
      expect(schema?.required).not.toContain('status');
    });

    it('returns 409 Conflict for FISCAL_NOTE_ALREADY_IMPORTED propagating details with existing IDs', async () => {
      importExecute.mockRejectedValueOnce(new FiscalNoteAlreadyImportedError(TEST_TRANSACTION_ID, TEST_FISCAL_NOTE_ID));

      const response = await request(getServer())
        .post('/fiscal-notes/import')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({
          input: VALID_CE_QR_URL,
          accountId: TEST_ACCOUNT_ID,
          categoryId: TEST_CATEGORY_ID,
        })
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        code: FiscalNoteErrorCodes.FISCAL_NOTE_ALREADY_IMPORTED,
        details: {
          existingTransactionId: TEST_TRANSACTION_ID,
          existingFiscalNoteId: TEST_FISCAL_NOTE_ID,
        },
      });
    });
  });

  describe('POST /transactions/:transactionId/fiscal-note', () => {
    it('returns 201 Created when linking a fiscal note to an existing expense', async () => {
      const fiscalNote = buildDomainFiscalNote();
      linkExecute.mockResolvedValueOnce(fiscalNote);

      const response = await request(getServer())
        .post(`/transactions/${TEST_TRANSACTION_ID}/fiscal-note`)
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({ input: VALID_CE_QR_URL })
        .expect(201);

      expect(linkExecute).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        transactionId: TEST_TRANSACTION_ID,
        input: VALID_CE_QR_URL,
      });
      expect(response.body).toMatchObject({
        object: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_ITEM,
        id: TEST_FISCAL_NOTE_ID,
        transactionId: TEST_TRANSACTION_ID,
        accessKey: VALID_CE_ACCESS_KEY,
        items: expect.arrayContaining([expect.objectContaining({ position: 1 })]) as unknown[],
        payments: expect.arrayContaining([expect.objectContaining({ position: 1 })]) as unknown[],
      });
    });

    it('returns 409 Conflict for TRANSACTION_ALREADY_HAS_FISCAL_NOTE, FISCAL_NOTE_ALREADY_IMPORTED (with details), and TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE', async () => {
      linkExecute.mockRejectedValueOnce(new TransactionAlreadyHasFiscalNoteError(TEST_FISCAL_NOTE_ID));
      const txConflictRes = await request(getServer())
        .post(`/transactions/${TEST_TRANSACTION_ID}/fiscal-note`)
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({ input: VALID_CE_QR_URL })
        .expect(409);
      expect(txConflictRes.body).toMatchObject({
        statusCode: 409,
        code: FiscalNoteErrorCodes.TRANSACTION_ALREADY_HAS_FISCAL_NOTE,
        details: {
          existingFiscalNoteId: TEST_FISCAL_NOTE_ID,
        },
      });

      const otherTransactionId = '66666666-6666-4666-a666-666666666666';
      linkExecute.mockRejectedValueOnce(new FiscalNoteAlreadyImportedError(otherTransactionId, TEST_FISCAL_NOTE_ID));
      const keyConflictRes = await request(getServer())
        .post(`/transactions/${TEST_TRANSACTION_ID}/fiscal-note`)
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({ input: VALID_CE_QR_URL })
        .expect(409);
      expect(keyConflictRes.body).toMatchObject({
        statusCode: 409,
        code: FiscalNoteErrorCodes.FISCAL_NOTE_ALREADY_IMPORTED,
        details: {
          existingTransactionId: otherTransactionId,
          existingFiscalNoteId: TEST_FISCAL_NOTE_ID,
        },
      });

      linkExecute.mockRejectedValueOnce(new TransactionTypeDoesNotSupportFiscalNoteError());
      const typeConflictRes = await request(getServer())
        .post(`/transactions/${TEST_TRANSACTION_ID}/fiscal-note`)
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({ input: VALID_CE_QR_URL })
        .expect(409);
      expect(typeConflictRes.body).toMatchObject({
        statusCode: 409,
        code: TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE_CODE,
      });
    });
  });

  describe('GET /transactions/:transactionId/fiscal-note', () => {
    it('returns 200 OK with full fiscal note including items and payments', async () => {
      getFiscalNoteExecute.mockResolvedValueOnce(buildDomainFiscalNote());

      const response = await request(getServer())
        .get(`/transactions/${TEST_TRANSACTION_ID}/fiscal-note`)
        .set('Authorization', TEST_BEARER_TOKEN)
        .expect(200);

      expect(getFiscalNoteExecute).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        transactionId: TEST_TRANSACTION_ID,
      });
      expect(response.body).toMatchObject({
        object: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_ITEM,
        id: TEST_FISCAL_NOTE_ID,
        transactionId: TEST_TRANSACTION_ID,
        items: [expect.objectContaining({ rawDescription: 'QUEIJO MUSSARELA FATIADO' })],
        payments: [expect.objectContaining({ methodLabel: 'Cartão de Débito', amountCents: 3141 })],
      });
    });

    it('returns 404 Not Found when fiscal note does not exist or transaction belongs to another user', async () => {
      getFiscalNoteExecute.mockRejectedValueOnce(new FiscalNoteNotFoundError());
      const missingNoteRes = await request(getServer())
        .get(`/transactions/${TEST_TRANSACTION_ID}/fiscal-note`)
        .set('Authorization', TEST_BEARER_TOKEN)
        .expect(404);
      expect(missingNoteRes.body).toMatchObject({
        statusCode: 404,
        code: FiscalNoteErrorCodes.FISCAL_NOTE_NOT_FOUND,
      });

      getFiscalNoteExecute.mockRejectedValueOnce(new TransactionNotFoundError());
      const otherUserTxRes = await request(getServer())
        .get(`/transactions/${TEST_TRANSACTION_ID}/fiscal-note`)
        .set('Authorization', TEST_BEARER_TOKEN)
        .expect(404);
      expect(otherUserTxRes.body).toMatchObject({
        statusCode: 404,
        code: 'TRANSACTION_NOT_FOUND',
      });
    });
  });

  describe('DELETE /transactions/:transactionId/fiscal-note', () => {
    it('returns 204 No Content when unlinking an active fiscal note', async () => {
      unlinkFiscalNoteExecute.mockResolvedValueOnce(undefined);

      const response = await request(getServer())
        .delete(`/transactions/${TEST_TRANSACTION_ID}/fiscal-note`)
        .set('Authorization', TEST_BEARER_TOKEN)
        .expect(204);

      expect(response.body).toEqual({});
      expect(unlinkFiscalNoteExecute).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        transactionId: TEST_TRANSACTION_ID,
      });
    });

    it('returns 404 Not Found when fiscal note does not exist', async () => {
      unlinkFiscalNoteExecute.mockRejectedValueOnce(new FiscalNoteNotFoundError());

      const response = await request(getServer())
        .delete(`/transactions/${TEST_TRANSACTION_ID}/fiscal-note`)
        .set('Authorization', TEST_BEARER_TOKEN)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        code: FiscalNoteErrorCodes.FISCAL_NOTE_NOT_FOUND,
      });
    });
  });

  describe('Transactions contract integration (hasFiscalNote & type change guard)', () => {
    it('exposes hasFiscalNote in GET /transactions and GET /transactions/:id', async () => {
      const txWithNote = buildDomainTransaction(true);
      const txWithoutNote = buildDomainTransaction(false, '77777777-7777-4777-a777-777777777777');

      listTransactionsExecute.mockResolvedValueOnce({
        items: [txWithNote, txWithoutNote],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        summary: {
          income: { pendingCents: 0, effectiveCents: 0, totalCents: 0 },
          expense: { pendingCents: 0, effectiveCents: 6282, totalCents: 6282 },
          balance: { pendingDeltaCents: 0, effectiveDeltaCents: -6282, expectedBalanceCents: -6282 },
        },
      });

      const listRes = await request(getServer())
        .get('/transactions')
        .set('Authorization', TEST_BEARER_TOKEN)
        .expect(200);

      expect(listRes.body).toMatchObject({
        object: RESPONSE_OBJECT_TYPES.TRANSACTION_LIST,
        data: [
          expect.objectContaining({ id: TEST_TRANSACTION_ID, hasFiscalNote: true }),
          expect.objectContaining({ id: '77777777-7777-4777-a777-777777777777', hasFiscalNote: false }),
        ],
      });

      getTransactionExecute.mockResolvedValueOnce(txWithNote);

      const getRes = await request(getServer())
        .get(`/transactions/${TEST_TRANSACTION_ID}`)
        .set('Authorization', TEST_BEARER_TOKEN)
        .expect(200);

      expect(getRes.body).toMatchObject({
        id: TEST_TRANSACTION_ID,
        hasFiscalNote: true,
      });
    });

    it('returns 409 TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE on PATCH /transactions/:id when changing type with active fiscal note', async () => {
      updateTransactionExecute.mockRejectedValueOnce(new TransactionTypeDoesNotSupportFiscalNoteError());

      const response = await request(getServer())
        .patch(`/transactions/${TEST_TRANSACTION_ID}`)
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({ type: TransactionType.INCOME })
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        code: TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE_CODE,
      });
    });
  });

  describe('Health liveness isolation', () => {
    it('keeps /health/liveness returning 200 OK even when SEFAZ circuit breaker is open', async () => {
      previewExecute.mockRejectedValueOnce(new SefazTemporarilyUnavailableError(60));

      await request(getServer())
        .post('/fiscal-notes/preview')
        .set('Authorization', TEST_BEARER_TOKEN)
        .send({ input: VALID_CE_QR_URL })
        .expect(503);

      const healthRes = await request(getServer()).get('/health/liveness').expect(200);

      expect(healthRes.body).toEqual({
        status: 'ok',
        info: {},
        error: {},
        details: {},
      });
    });
  });
});
