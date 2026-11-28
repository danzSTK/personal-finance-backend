import { TRANSACTION_DESCRIPTION_MAX_LENGTH } from '@/common/models/constants';
import { TransactionStatus, TransactionType } from '@/common/models/enums';
import { toDateOnly } from '@/common/utils/date-only';
import { ParsedFiscalNoteData } from '@/modules/fiscal-notes/application/ports';
import { FiscalNoteQueryService } from '@/modules/fiscal-notes/application/services/fiscal-note-query.service';
import { PreviewFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/preview-fiscal-note/preview-fiscal-note.use-case';
import {
  FiscalNoteMetricNames,
  FiscalNoteOperations,
  SEFAZ_CE_PARSER_VERSION,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import { FiscalNoteItem } from '@/modules/fiscal-notes/domain/entities/fiscal-note-item.entity';
import { IFiscalNoteRepository } from '@/modules/fiscal-notes/domain/repositories';
import { FiscalNoteInput } from '@/modules/fiscal-notes/domain/value-objects/fiscal-note-input.vo';
import { METRICS_RECORDER } from '@/shared/observability';
import { Test } from '@nestjs/testing';

const VALID_CE_KEY = '23261003539462000250651030000760541443208780';

function buildParsed(issuerName = 'SUPERMERCADO EXEMPLO'): ParsedFiscalNoteData {
  return {
    accessKey: VALID_CE_KEY,
    sourceUf: '23',
    number: '76054',
    series: '103',
    issuedAt: new Date('2026-10-16T01:15:30.000Z'),
    issuedDate: toDateOnly('2026-10-15'),
    protocol: '223260123456789',
    issuerName,
    issuerCnpj: '03539462000250',
    issuerAddress: 'Fortaleza, CE',
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
        rawDescription: 'CAFE',
        storeCode: '1',
        unit: 'UN',
        quantity: 1,
        unitPrice: 31.41,
        totalPriceCents: 3141,
      },
    ],
    payments: [{ position: 1, methodLabel: 'PIX', amountCents: 3141 }],
  };
}

describe('PreviewFiscalNoteUseCase', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  let useCase: PreviewFiscalNoteUseCase;
  let queryService: jest.Mocked<FiscalNoteQueryService>;
  let fiscalNoteRepository: jest.Mocked<IFiscalNoteRepository>;
  let metricsRecorder: { incrementCounter: jest.Mock; observeDuration: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    queryService = { resolve: jest.fn() } as unknown as jest.Mocked<FiscalNoteQueryService>;
    fiscalNoteRepository = {
      findActiveByUserIdAndAccessKey: jest.fn(),
    } as unknown as jest.Mocked<IFiscalNoteRepository>;
    metricsRecorder = {
      incrementCounter: jest.fn(),
      observeDuration: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PreviewFiscalNoteUseCase,
        { provide: FiscalNoteQueryService, useValue: queryService },
        { provide: IFiscalNoteRepository, useValue: fiscalNoteRepository },
        { provide: METRICS_RECORDER, useValue: metricsRecorder },
      ],
    }).compile();

    useCase = moduleRef.get(PreviewFiscalNoteUseCase);
  });

  describe('execute', () => {
    it('returns preview with suggestedTransaction and alreadyImported=false when note was not imported', async () => {
      const longIssuerName = 'A'.repeat(TRANSACTION_DESCRIPTION_MAX_LENGTH + 20);
      const parsed = buildParsed(longIssuerName);
      queryService.resolve.mockResolvedValue({
        input: FiscalNoteInput.parse(VALID_CE_KEY),
        parsed,
        cacheHit: true,
      });
      fiscalNoteRepository.findActiveByUserIdAndAccessKey.mockResolvedValue(null);

      const output = await useCase.execute({ userId, input: VALID_CE_KEY });

      expect(output.alreadyImported).toBe(false);
      expect(output.existingTransactionId).toBeNull();
      expect(output.existingFiscalNoteId).toBeNull();
      expect(output.cacheHit).toBe(true);
      expect(output.suggestedTransaction).toEqual({
        type: TransactionType.EXPENSE,
        status: TransactionStatus.EFFECTIVE,
        amountCents: 3141,
        date: '2026-10-15',
        description: 'A'.repeat(TRANSACTION_DESCRIPTION_MAX_LENGTH),
      });
      expect(output.fiscalNote).toBe(parsed);
      expect(metricsRecorder.incrementCounter).toHaveBeenCalledWith(FiscalNoteMetricNames.OPERATIONS_TOTAL, {
        operation: FiscalNoteOperations.PREVIEW,
      });
    });

    it('returns alreadyImported=true with existing IDs when note is active for user', async () => {
      const parsed = buildParsed();
      const existingNote = FiscalNote.create(
        {
          id: '22222222-2222-4222-a222-222222222222',
          userId,
          transactionId: '33333333-3333-4333-a333-333333333333',
          accessKey: VALID_CE_KEY,
          sourceUf: '23',
          number: '76054',
          series: '103',
          issuedAt: parsed.issuedAt,
          protocol: null,
          issuerName: parsed.issuerName,
          issuerCnpj: parsed.issuerCnpj,
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
            FiscalNoteItem.create({
              fiscalNoteId: '22222222-2222-4222-a222-222222222222',
              position: 1,
              rawDescription: 'CAFE',
              storeCode: null,
              unit: 'UN',
              quantity: 1,
              unitPrice: 31.41,
              totalPriceCents: 3141,
            }),
          ],
          payments: [],
        },
        '22222222-2222-4222-a222-222222222222',
      );

      queryService.resolve.mockResolvedValue({
        input: FiscalNoteInput.parse(VALID_CE_KEY),
        parsed,
        cacheHit: false,
      });
      fiscalNoteRepository.findActiveByUserIdAndAccessKey.mockResolvedValue(existingNote);

      const output = await useCase.execute({ userId, input: VALID_CE_KEY });

      expect(output.alreadyImported).toBe(true);
      expect(output.existingTransactionId).toBe('33333333-3333-4333-a333-333333333333');
      expect(output.existingFiscalNoteId).toBe('22222222-2222-4222-a222-222222222222');
    });
  });
});
