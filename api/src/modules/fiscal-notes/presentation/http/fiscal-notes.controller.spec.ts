/* eslint-disable @typescript-eslint/unbound-method */
import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { TransactionStatus, TransactionType } from '@/common/models/enums';
import { toDateOnly } from '@/common/utils/date-only';
import { ImportFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/import-fiscal-note/import-fiscal-note.use-case';
import { PreviewFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/preview-fiscal-note/preview-fiscal-note.use-case';
import { SEFAZ_CE_PARSER_VERSION } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import { FiscalNoteItem } from '@/modules/fiscal-notes/domain/entities/fiscal-note-item.entity';
import { FiscalNotePayment } from '@/modules/fiscal-notes/domain/entities/fiscal-note-payment.entity';
import { FiscalNotesController } from '@/modules/fiscal-notes/presentation/http/fiscal-notes.controller';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { User } from '@/modules/users/domain/entities/user.entity';

const VALID_CE_KEY = '23261003539462000250651030000760541443208780';

describe('FiscalNotesController', () => {
  const user = { id: '11111111-1111-4111-a111-111111111111' } as unknown as User;
  const accountId = '22222222-2222-4222-a222-222222222222';
  const categoryId = '33333333-3333-4333-a333-333333333333';
  const transactionId = '44444444-4444-4444-a444-444444444444';
  const noteId = '55555555-5555-4555-a555-555555555555';

  let controller: FiscalNotesController;
  let previewUseCase: jest.Mocked<PreviewFiscalNoteUseCase>;
  let importUseCase: jest.Mocked<ImportFiscalNoteUseCase>;

  beforeEach(() => {
    jest.clearAllMocks();
    previewUseCase = { execute: jest.fn() } as unknown as jest.Mocked<PreviewFiscalNoteUseCase>;
    importUseCase = { execute: jest.fn() } as unknown as jest.Mocked<ImportFiscalNoteUseCase>;
    controller = new FiscalNotesController(previewUseCase, importUseCase);
  });

  describe('preview', () => {
    it('delegates to PreviewFiscalNoteUseCase and returns fiscal_note.preview DTO', async () => {
      previewUseCase.execute.mockResolvedValue({
        alreadyImported: false,
        existingTransactionId: null,
        existingFiscalNoteId: null,
        cacheHit: true,
        suggestedTransaction: {
          type: TransactionType.EXPENSE,
          status: TransactionStatus.EFFECTIVE,
          amountCents: 3141,
          date: toDateOnly('2026-10-15'),
          description: 'SUPERMERCADO EXEMPLO',
        },
        fiscalNote: {
          accessKey: VALID_CE_KEY,
          sourceUf: '23',
          number: '76054',
          series: '103',
          issuedAt: new Date('2026-10-16T01:15:30.000Z'),
          issuedDate: toDateOnly('2026-10-15'),
          protocol: '223260123456789',
          issuerName: 'SUPERMERCADO EXEMPLO',
          issuerCnpj: '03539462000250',
          issuerAddress: null,
          grossAmountCents: 3141,
          discountAmountCents: 0,
          payableAmountCents: 3141,
          taxAmountCents: 0,
          changeAmountCents: null,
          xmlVersion: '4.00',
          xsltVersion: '2.05',
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
          payments: [{ position: 1, methodLabel: 'PIX', amountCents: 3141 }],
        },
      });

      const response = await controller.preview(user, { input: VALID_CE_KEY });

      expect(previewUseCase.execute).toHaveBeenCalledWith({ userId: user.id, input: VALID_CE_KEY });
      expect(response.object).toBe(RESPONSE_OBJECT_TYPES.FISCAL_NOTE_PREVIEW);
      expect(response.cacheHit).toBe(true);
      expect(response.fiscalNote.items).toHaveLength(1);
    });
  });

  describe('importFiscalNote', () => {
    it('delegates to ImportFiscalNoteUseCase and returns fiscal_note.import DTO', async () => {
      const transaction = Transaction.create(
        {
          userId: user.id,
          accountId,
          destinationAccountId: null,
          categoryId,
          type: TransactionType.EXPENSE,
          status: TransactionStatus.EFFECTIVE,
          amountCents: 3141,
          date: toDateOnly('2026-10-15'),
          effectiveAt: new Date('2026-10-16T01:15:30.000Z'),
          description: 'SUPERMERCADO EXEMPLO',
          direction: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        transactionId,
      );
      const fiscalNote = FiscalNote.create(
        {
          id: noteId,
          userId: user.id,
          transactionId,
          accessKey: VALID_CE_KEY,
          sourceUf: '23',
          number: '76054',
          series: '103',
          issuedAt: new Date('2026-10-16T01:15:30.000Z'),
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
            FiscalNoteItem.create({
              fiscalNoteId: noteId,
              position: 1,
              rawDescription: 'CAFE',
              storeCode: null,
              unit: 'UN',
              quantity: 1,
              unitPrice: 31.41,
              totalPriceCents: 3141,
            }),
          ],
          payments: [
            FiscalNotePayment.create({
              fiscalNoteId: noteId,
              position: 1,
              methodLabel: 'PIX',
              amountCents: 3141,
            }),
          ],
        },
        noteId,
      );

      importUseCase.execute.mockResolvedValue({ transaction, fiscalNote });

      const response = await controller.importFiscalNote(user, {
        input: VALID_CE_KEY,
        accountId,
        categoryId,
      });

      expect(importUseCase.execute).toHaveBeenCalledWith({
        userId: user.id,
        input: VALID_CE_KEY,
        accountId,
        categoryId,
        amountCents: undefined,
        date: undefined,
        description: undefined,
        status: undefined,
      });
      expect(response.object).toBe(RESPONSE_OBJECT_TYPES.FISCAL_NOTE_IMPORT);
      expect(response.transaction.id).toBe(transactionId);
      expect(response.fiscalNote.object).toBe(RESPONSE_OBJECT_TYPES.FISCAL_NOTE_ITEM);
      expect(response.fiscalNote.id).toBe(noteId);
    });
  });
});
