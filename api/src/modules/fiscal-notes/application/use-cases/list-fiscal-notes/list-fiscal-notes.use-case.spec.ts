/* eslint-disable @typescript-eslint/unbound-method */
import { toDateOnly } from '@/common/utils/date-only';
import { ListFiscalNotesUseCase } from '@/modules/fiscal-notes/application/use-cases/list-fiscal-notes/list-fiscal-notes.use-case';
import {
  FISCAL_NOTE_LIST_DEFAULT_LIMIT,
  FISCAL_NOTE_LIST_DEFAULT_PAGE,
  FISCAL_NOTE_LIST_DEFAULT_SORT,
  FiscalNoteListSorts,
  FiscalNoteMetricLabelKeys,
  FiscalNoteMetricNames,
  FiscalNoteOperations,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNoteInvalidInputError } from '@/modules/fiscal-notes/domain/errors';
import { FiscalNoteListItem, IFiscalNoteRepository } from '@/modules/fiscal-notes/domain/repositories';
import { type IMetricsRecorder, METRICS_RECORDER } from '@/shared/observability';
import { Test } from '@nestjs/testing';

describe('ListFiscalNotesUseCase', () => {
  const userId = '11111111-1111-4111-a111-111111111111';

  let useCase: ListFiscalNotesUseCase;
  let fiscalNoteRepository: jest.Mocked<IFiscalNoteRepository>;
  let metricsRecorder: jest.Mocked<IMetricsRecorder>;

  const emptySummary = {
    totalNotes: 0,
    totalGrossAmountCents: 0,
    totalDiscountAmountCents: 0,
    totalPayableAmountCents: 0,
    totalTaxAmountCents: 0,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    fiscalNoteRepository = {
      list: jest.fn(),
    } as unknown as jest.Mocked<IFiscalNoteRepository>;
    metricsRecorder = {
      incrementCounter: jest.fn(),
      observeDuration: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ListFiscalNotesUseCase,
        { provide: IFiscalNoteRepository, useValue: fiscalNoteRepository },
        { provide: METRICS_RECORDER, useValue: metricsRecorder },
      ],
    }).compile();

    useCase = moduleRef.get(ListFiscalNotesUseCase);
  });

  describe('execute', () => {
    it('applies default pagination/sort, normalizes whitespace-only search to undefined, and increments metric', async () => {
      fiscalNoteRepository.list.mockResolvedValue({
        items: [],
        total: 0,
        summary: emptySummary,
      });

      const result = await useCase.execute({
        userId,
        search: '   ',
      });

      expect(fiscalNoteRepository.list).toHaveBeenCalledWith({
        userId,
        issuedFrom: undefined,
        issuedTo: undefined,
        issuerCnpj: undefined,
        sourceUf: undefined,
        minAmountCents: undefined,
        maxAmountCents: undefined,
        search: undefined,
        page: FISCAL_NOTE_LIST_DEFAULT_PAGE,
        limit: FISCAL_NOTE_LIST_DEFAULT_LIMIT,
        sort: FISCAL_NOTE_LIST_DEFAULT_SORT,
      });
      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        summary: emptySummary,
      });
      expect(metricsRecorder.incrementCounter).toHaveBeenCalledWith(FiscalNoteMetricNames.OPERATIONS_TOTAL, {
        [FiscalNoteMetricLabelKeys.OPERATION]: FiscalNoteOperations.LIST,
      });
    });

    it('computes pagination flags accurately for middle page and out-of-range page', async () => {
      const sampleItem = { id: 'note-1' } as FiscalNoteListItem;
      const summary = {
        totalNotes: 25,
        totalGrossAmountCents: 10000,
        totalDiscountAmountCents: 500,
        totalPayableAmountCents: 9500,
        totalTaxAmountCents: 1200,
      };
      fiscalNoteRepository.list.mockResolvedValueOnce({
        items: [sampleItem],
        total: 25,
        summary,
      });

      const middlePage = await useCase.execute({
        userId,
        page: 2,
        limit: 10,
        sort: FiscalNoteListSorts.PAYABLE_AMOUNT_DESC,
        search: '  cafe  ',
      });

      expect(fiscalNoteRepository.list).toHaveBeenCalledWith({
        userId,
        issuedFrom: undefined,
        issuedTo: undefined,
        issuerCnpj: undefined,
        sourceUf: undefined,
        minAmountCents: undefined,
        maxAmountCents: undefined,
        search: 'cafe',
        page: 2,
        limit: 10,
        sort: FiscalNoteListSorts.PAYABLE_AMOUNT_DESC,
      });
      expect(middlePage.totalPages).toBe(3);
      expect(middlePage.hasNextPage).toBe(true);
      expect(middlePage.hasPreviousPage).toBe(true);

      fiscalNoteRepository.list.mockResolvedValueOnce({
        items: [],
        total: 25,
        summary,
      });

      const outOfRange = await useCase.execute({
        userId,
        page: 5,
        limit: 10,
      });

      expect(outOfRange.items).toEqual([]);
      expect(outOfRange.total).toBe(25);
      expect(outOfRange.totalPages).toBe(3);
      expect(outOfRange.hasNextPage).toBe(false);
      expect(outOfRange.hasPreviousPage).toBe(true);
    });

    it('throws FiscalNoteInvalidInputError when issuedFrom is greater than issuedTo', async () => {
      await expect(
        useCase.execute({
          userId,
          issuedFrom: toDateOnly('2026-10-20'),
          issuedTo: toDateOnly('2026-10-10'),
        }),
      ).rejects.toThrow(FiscalNoteInvalidInputError);

      expect(fiscalNoteRepository.list).not.toHaveBeenCalled();
    });

    it('throws FiscalNoteInvalidInputError when minAmountCents is greater than maxAmountCents', async () => {
      await expect(
        useCase.execute({
          userId,
          minAmountCents: 5000,
          maxAmountCents: 1000,
        }),
      ).rejects.toThrow(FiscalNoteInvalidInputError);

      expect(fiscalNoteRepository.list).not.toHaveBeenCalled();
    });
  });
});
