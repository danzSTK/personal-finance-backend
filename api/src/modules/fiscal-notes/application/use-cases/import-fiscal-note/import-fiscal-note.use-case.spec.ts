/* eslint-disable @typescript-eslint/unbound-method */
import { TransactionStatus, TransactionType } from '@/common/models/enums';
import { toDateOnly } from '@/common/utils/date-only';
import { FiscalNoteAlreadyImportedError } from '@/modules/fiscal-notes/application/errors';
import { ParsedFiscalNoteData } from '@/modules/fiscal-notes/application/ports';
import { FiscalNoteQueryService } from '@/modules/fiscal-notes/application/services/fiscal-note-query.service';
import { ImportFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/import-fiscal-note/import-fiscal-note.use-case';
import {
  FiscalNoteDbConstraints,
  PG_UNIQUE_VIOLATION_CODE,
  SEFAZ_CE_PARSER_VERSION,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import { IFiscalNoteRepository } from '@/modules/fiscal-notes/domain/repositories';
import { FiscalNoteInput } from '@/modules/fiscal-notes/domain/value-objects/fiscal-note-input.vo';
import { TransactionFiscalNotePort } from '@/modules/transactions/application/ports/transaction-fiscal-note.port';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { InvalidTransactionError } from '@/modules/transactions/domain/errors';
import { METRICS_RECORDER } from '@/shared/observability';
import { Test } from '@nestjs/testing';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';

const VALID_CE_KEY = '23261003539462000250651030000760541443208780';

function buildParsed(payableAmountCents = 3141): ParsedFiscalNoteData {
  return {
    accessKey: VALID_CE_KEY,
    sourceUf: '23',
    number: '76054',
    series: '103',
    issuedAt: new Date('2026-10-16T01:15:30.000Z'),
    issuedDate: toDateOnly('2026-10-15'),
    protocol: '223260123456789',
    issuerName: 'SUPERMERCADO EXEMPLO',
    issuerCnpj: '03539462000250',
    issuerAddress: 'Fortaleza, CE',
    grossAmountCents: payableAmountCents,
    discountAmountCents: 0,
    payableAmountCents,
    taxAmountCents: 0,
    changeAmountCents: null,
    xmlVersion: '4.00',
    xsltVersion: '2.05',
    parserVersion: SEFAZ_CE_PARSER_VERSION,
    items: [
      {
        position: 1,
        rawDescription: 'CAFE',
        storeCode: '1',
        unit: 'UN',
        quantity: 1,
        unitPrice: payableAmountCents / 100,
        totalPriceCents: payableAmountCents,
      },
    ],
    payments: [{ position: 1, methodLabel: 'PIX', amountCents: payableAmountCents }],
  };
}

describe('ImportFiscalNoteUseCase', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const accountId = '22222222-2222-4222-a222-222222222222';
  const categoryId = '33333333-3333-4333-a333-333333333333';
  const transactionId = '44444444-4444-4444-a444-444444444444';

  let useCase: ImportFiscalNoteUseCase;
  let queryService: jest.Mocked<FiscalNoteQueryService>;
  let fiscalNoteRepository: jest.Mocked<IFiscalNoteRepository>;
  let transactionPort: jest.Mocked<TransactionFiscalNotePort>;
  let manager: EntityManager;
  let dataSource: { transaction: jest.Mock };
  let metricsRecorder: { incrementCounter: jest.Mock; observeDuration: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    manager = {} as EntityManager;
    dataSource = {
      transaction: jest.fn((cb: (em: EntityManager) => Promise<unknown>) => cb(manager)),
    };
    queryService = { resolve: jest.fn() } as unknown as jest.Mocked<FiscalNoteQueryService>;
    fiscalNoteRepository = {
      findActiveByUserIdAndAccessKey: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<IFiscalNoteRepository>;
    transactionPort = {
      createExpenseWithinTransaction: jest.fn(),
    } as unknown as jest.Mocked<TransactionFiscalNotePort>;
    metricsRecorder = { incrementCounter: jest.fn(), observeDuration: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ImportFiscalNoteUseCase,
        { provide: FiscalNoteQueryService, useValue: queryService },
        { provide: IFiscalNoteRepository, useValue: fiscalNoteRepository },
        { provide: TransactionFiscalNotePort, useValue: transactionPort },
        { provide: DataSource, useValue: dataSource },
        { provide: METRICS_RECORDER, useValue: metricsRecorder },
      ],
    }).compile();

    useCase = moduleRef.get(ImportFiscalNoteUseCase);
  });

  describe('execute', () => {
    it('resolves SEFAZ note before transaction and creates expense + FiscalNote atomically', async () => {
      const parsed = buildParsed(3141);
      const callOrder: string[] = [];

      queryService.resolve.mockImplementation(() => {
        callOrder.push('resolve');
        return Promise.resolve({
          input: FiscalNoteInput.parse(VALID_CE_KEY),
          parsed,
          cacheHit: false,
        });
      });

      dataSource.transaction.mockImplementation((cb: (em: EntityManager) => Promise<unknown>) => {
        callOrder.push('transaction');
        return cb(manager);
      });

      const createdTransaction = Transaction.create(
        {
          userId,
          accountId,
          destinationAccountId: null,
          categoryId,
          type: TransactionType.EXPENSE,
          status: TransactionStatus.EFFECTIVE,
          amountCents: 3141,
          date: toDateOnly('2026-10-15'),
          effectiveAt: new Date('2026-10-15T12:00:00.000Z'),
          description: 'SUPERMERCADO EXEMPLO',
          direction: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        transactionId,
      );

      fiscalNoteRepository.findActiveByUserIdAndAccessKey.mockResolvedValue(null);
      transactionPort.createExpenseWithinTransaction.mockResolvedValue(createdTransaction);
      fiscalNoteRepository.save.mockImplementation(note => Promise.resolve(note));

      const result = await useCase.execute({
        userId,
        input: VALID_CE_KEY,
        accountId,
        categoryId,
      });

      expect(callOrder).toEqual(['resolve', 'transaction']);
      expect(transactionPort.createExpenseWithinTransaction).toHaveBeenCalledWith(
        {
          userId,
          accountId,
          categoryId,
          amountCents: 3141,
          date: '2026-10-15',
          description: 'SUPERMERCADO EXEMPLO',
          status: TransactionStatus.EFFECTIVE,
        },
        { manager },
      );
      expect(fiscalNoteRepository.save).toHaveBeenCalledWith(expect.any(FiscalNote), { manager });
      expect(result.transaction).toBe(createdTransaction);
      expect(result.fiscalNote.transactionId).toBe(transactionId);
      expect(result.fiscalNote.items).toHaveLength(1);
    });

    it('rejects zero payableAmountCents without positive override with InvalidTransactionError before opening transaction', async () => {
      const parsed = buildParsed(0);
      queryService.resolve.mockResolvedValue({
        input: FiscalNoteInput.parse(VALID_CE_KEY),
        parsed,
        cacheHit: false,
      });

      await expect(useCase.execute({ userId, input: VALID_CE_KEY, accountId, categoryId })).rejects.toThrow(
        InvalidTransactionError,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws FiscalNoteAlreadyImportedError when note is already active for user', async () => {
      const parsed = buildParsed();
      queryService.resolve.mockResolvedValue({
        input: FiscalNoteInput.parse(VALID_CE_KEY),
        parsed,
        cacheHit: true,
      });
      fiscalNoteRepository.findActiveByUserIdAndAccessKey.mockResolvedValue({
        id: 'existing-note-id',
        transactionId: 'existing-tx-id',
      } as FiscalNote);

      await expect(useCase.execute({ userId, input: VALID_CE_KEY, accountId, categoryId })).rejects.toMatchObject({
        code: 'FISCAL_NOTE_ALREADY_IMPORTED',
        existingTransactionId: 'existing-tx-id',
        existingFiscalNoteId: 'existing-note-id',
      });
      expect(transactionPort.createExpenseWithinTransaction).not.toHaveBeenCalled();
    });

    it('converts PostgreSQL 23505 race condition on user+accessKey into FiscalNoteAlreadyImportedError', async () => {
      const parsed = buildParsed();
      queryService.resolve.mockResolvedValue({
        input: FiscalNoteInput.parse(VALID_CE_KEY),
        parsed,
        cacheHit: false,
      });
      fiscalNoteRepository.findActiveByUserIdAndAccessKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'race-note-id', transactionId: 'race-tx-id' } as FiscalNote);

      transactionPort.createExpenseWithinTransaction.mockResolvedValue({ id: transactionId } as Transaction);

      const queryError = new QueryFailedError('INSERT', [], new Error('duplicate'));
      Object.assign(queryError, {
        driverError: {
          code: PG_UNIQUE_VIOLATION_CODE,
          constraint: FiscalNoteDbConstraints.USER_ACCESS_KEY_ACTIVE,
        },
      });
      fiscalNoteRepository.save.mockRejectedValue(queryError);

      await expect(useCase.execute({ userId, input: VALID_CE_KEY, accountId, categoryId })).rejects.toThrow(
        FiscalNoteAlreadyImportedError,
      );
      expect(fiscalNoteRepository.findActiveByUserIdAndAccessKey).toHaveBeenNthCalledWith(2, userId, VALID_CE_KEY);
    });
  });
});
