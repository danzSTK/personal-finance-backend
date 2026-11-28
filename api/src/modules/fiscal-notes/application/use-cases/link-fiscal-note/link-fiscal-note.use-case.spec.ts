/* eslint-disable @typescript-eslint/unbound-method */
import { toDateOnly } from '@/common/utils/date-only';
import {
  FiscalNoteAlreadyImportedError,
  TransactionAlreadyHasFiscalNoteError,
} from '@/modules/fiscal-notes/application/errors';
import { ParsedFiscalNoteData } from '@/modules/fiscal-notes/application/ports';
import { FiscalNoteQueryService } from '@/modules/fiscal-notes/application/services/fiscal-note-query.service';
import { LinkFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/link-fiscal-note/link-fiscal-note.use-case';
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
import { METRICS_RECORDER } from '@/shared/observability';
import { Test } from '@nestjs/testing';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';

const VALID_CE_KEY = '23261003539462000250651030000760541443208780';

function buildParsed(): ParsedFiscalNoteData {
  return {
    accessKey: VALID_CE_KEY,
    sourceUf: '23',
    number: '76054',
    series: '103',
    issuedAt: new Date('2026-10-16T01:15:30.000Z'),
    issuedDate: toDateOnly('2026-10-15'),
    protocol: null,
    issuerName: 'SUPERMERCADO EXEMPLO',
    issuerCnpj: '03539462000250',
    issuerAddress: null,
    grossAmountCents: 3141,
    discountAmountCents: 0,
    payableAmountCents: 3141,
    taxAmountCents: 0,
    changeAmountCents: null,
    xmlVersion: null,
    xsltVersion: null,
    parserVersion: SEFAZ_CE_PARSER_VERSION,
    items: [
      {
        position: 1,
        rawDescription: 'CAFE',
        storeCode: null,
        unit: 'UN',
        quantity: 1,
        unitPrice: 31.41,
        totalPriceCents: 3141,
      },
    ],
    payments: [],
  };
}

describe('LinkFiscalNoteUseCase', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const transactionId = '44444444-4444-4444-a444-444444444444';

  let useCase: LinkFiscalNoteUseCase;
  let queryService: jest.Mocked<FiscalNoteQueryService>;
  let fiscalNoteRepository: jest.Mocked<IFiscalNoteRepository>;
  let transactionPort: jest.Mocked<TransactionFiscalNotePort>;
  let manager: EntityManager;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    manager = {} as EntityManager;
    dataSource = {
      transaction: jest.fn((cb: (em: EntityManager) => Promise<unknown>) => cb(manager)),
    };
    queryService = { resolve: jest.fn() } as unknown as jest.Mocked<FiscalNoteQueryService>;
    fiscalNoteRepository = {
      findActiveByTransactionId: jest.fn(),
      findActiveByUserIdAndAccessKey: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<IFiscalNoteRepository>;
    transactionPort = {
      lockAndValidateExpenseForFiscalNoteLink: jest.fn(),
    } as unknown as jest.Mocked<TransactionFiscalNotePort>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        LinkFiscalNoteUseCase,
        { provide: FiscalNoteQueryService, useValue: queryService },
        { provide: IFiscalNoteRepository, useValue: fiscalNoteRepository },
        { provide: TransactionFiscalNotePort, useValue: transactionPort },
        { provide: DataSource, useValue: dataSource },
        { provide: METRICS_RECORDER, useValue: { incrementCounter: jest.fn(), observeDuration: jest.fn() } },
      ],
    }).compile();

    useCase = moduleRef.get(LinkFiscalNoteUseCase);
  });

  describe('execute', () => {
    it('resolves SEFAZ note before transaction, locks expense, and persists FiscalNote without modifying transaction', async () => {
      const parsed = buildParsed();
      queryService.resolve.mockResolvedValue({
        input: FiscalNoteInput.parse(VALID_CE_KEY),
        parsed,
        cacheHit: true,
      });
      transactionPort.lockAndValidateExpenseForFiscalNoteLink.mockResolvedValue({ id: transactionId } as Transaction);
      fiscalNoteRepository.findActiveByTransactionId.mockResolvedValue(null);
      fiscalNoteRepository.findActiveByUserIdAndAccessKey.mockResolvedValue(null);
      fiscalNoteRepository.save.mockImplementation(note => Promise.resolve(note));

      const result = await useCase.execute({ userId, transactionId, input: VALID_CE_KEY });

      expect(transactionPort.lockAndValidateExpenseForFiscalNoteLink).toHaveBeenCalledWith(
        { userId, transactionId },
        { manager },
      );
      expect(fiscalNoteRepository.save).toHaveBeenCalledWith(expect.any(FiscalNote), { manager });
      expect(result.transactionId).toBe(transactionId);
    });

    it('throws TransactionAlreadyHasFiscalNoteError when transaction already has active note', async () => {
      queryService.resolve.mockResolvedValue({
        input: FiscalNoteInput.parse(VALID_CE_KEY),
        parsed: buildParsed(),
        cacheHit: true,
      });
      transactionPort.lockAndValidateExpenseForFiscalNoteLink.mockResolvedValue({ id: transactionId } as Transaction);
      fiscalNoteRepository.findActiveByTransactionId.mockResolvedValue({ id: 'note-1' } as FiscalNote);

      await expect(useCase.execute({ userId, transactionId, input: VALID_CE_KEY })).rejects.toMatchObject({
        code: 'TRANSACTION_ALREADY_HAS_FISCAL_NOTE',
        existingFiscalNoteId: 'note-1',
      });
    });

    it('throws FiscalNoteAlreadyImportedError when access key is already active for user', async () => {
      queryService.resolve.mockResolvedValue({
        input: FiscalNoteInput.parse(VALID_CE_KEY),
        parsed: buildParsed(),
        cacheHit: true,
      });
      transactionPort.lockAndValidateExpenseForFiscalNoteLink.mockResolvedValue({ id: transactionId } as Transaction);
      fiscalNoteRepository.findActiveByTransactionId.mockResolvedValue(null);
      fiscalNoteRepository.findActiveByUserIdAndAccessKey.mockResolvedValue({
        id: 'note-2',
        transactionId: 'tx-2',
      } as FiscalNote);

      await expect(useCase.execute({ userId, transactionId, input: VALID_CE_KEY })).rejects.toThrow(
        FiscalNoteAlreadyImportedError,
      );
    });

    it('maps PostgreSQL 23505 on TRANSACTION_ACTIVE to TransactionAlreadyHasFiscalNoteError', async () => {
      queryService.resolve.mockResolvedValue({
        input: FiscalNoteInput.parse(VALID_CE_KEY),
        parsed: buildParsed(),
        cacheHit: true,
      });
      transactionPort.lockAndValidateExpenseForFiscalNoteLink.mockResolvedValue({ id: transactionId } as Transaction);
      fiscalNoteRepository.findActiveByTransactionId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'race-note-id' } as FiscalNote);
      fiscalNoteRepository.findActiveByUserIdAndAccessKey.mockResolvedValue(null);

      const queryError = new QueryFailedError('INSERT', [], new Error('duplicate'));
      Object.assign(queryError, {
        driverError: {
          code: PG_UNIQUE_VIOLATION_CODE,
          constraint: FiscalNoteDbConstraints.TRANSACTION_ACTIVE,
        },
      });
      fiscalNoteRepository.save.mockRejectedValue(queryError);

      await expect(useCase.execute({ userId, transactionId, input: VALID_CE_KEY })).rejects.toThrow(
        TransactionAlreadyHasFiscalNoteError,
      );
    });
  });
});
