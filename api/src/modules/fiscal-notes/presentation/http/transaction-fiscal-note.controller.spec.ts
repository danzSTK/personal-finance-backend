/* eslint-disable @typescript-eslint/unbound-method */
import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { GetTransactionFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/get-transaction-fiscal-note/get-transaction-fiscal-note.use-case';
import { LinkFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/link-fiscal-note/link-fiscal-note.use-case';
import { UnlinkTransactionFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/unlink-transaction-fiscal-note/unlink-transaction-fiscal-note.use-case';
import { SEFAZ_CE_PARSER_VERSION } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import { FiscalNoteItem } from '@/modules/fiscal-notes/domain/entities/fiscal-note-item.entity';
import { TransactionFiscalNoteController } from '@/modules/fiscal-notes/presentation/http/transaction-fiscal-note.controller';
import { User } from '@/modules/users/domain/entities/user.entity';

const VALID_CE_KEY = '23261003539462000250651030000760541443208780';

function buildFiscalNote(userId: string, transactionId: string, noteId: string): FiscalNote {
  return FiscalNote.create(
    {
      id: noteId,
      userId,
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
      payments: [],
    },
    noteId,
  );
}

describe('TransactionFiscalNoteController', () => {
  const user = { id: '11111111-1111-4111-a111-111111111111' } as unknown as User;
  const transactionId = '44444444-4444-4444-a444-444444444444';
  const noteId = '55555555-5555-4555-a555-555555555555';

  let controller: TransactionFiscalNoteController;
  let linkUseCase: jest.Mocked<LinkFiscalNoteUseCase>;
  let getUseCase: jest.Mocked<GetTransactionFiscalNoteUseCase>;
  let unlinkUseCase: jest.Mocked<UnlinkTransactionFiscalNoteUseCase>;

  beforeEach(() => {
    jest.clearAllMocks();
    linkUseCase = { execute: jest.fn() } as unknown as jest.Mocked<LinkFiscalNoteUseCase>;
    getUseCase = { execute: jest.fn() } as unknown as jest.Mocked<GetTransactionFiscalNoteUseCase>;
    unlinkUseCase = { execute: jest.fn() } as unknown as jest.Mocked<UnlinkTransactionFiscalNoteUseCase>;
    controller = new TransactionFiscalNoteController(linkUseCase, getUseCase, unlinkUseCase);
  });

  describe('link', () => {
    it('delegates to LinkFiscalNoteUseCase and returns fiscal_note.item DTO', async () => {
      const note = buildFiscalNote(user.id, transactionId, noteId);
      linkUseCase.execute.mockResolvedValue(note);

      const response = await controller.link(user, transactionId, { input: VALID_CE_KEY });

      expect(linkUseCase.execute).toHaveBeenCalledWith({
        userId: user.id,
        transactionId,
        input: VALID_CE_KEY,
      });
      expect(response.object).toBe(RESPONSE_OBJECT_TYPES.FISCAL_NOTE_ITEM);
      expect(response.id).toBe(noteId);
    });
  });

  describe('getByTransaction', () => {
    it('delegates to GetTransactionFiscalNoteUseCase and returns fiscal_note.item DTO', async () => {
      const note = buildFiscalNote(user.id, transactionId, noteId);
      getUseCase.execute.mockResolvedValue(note);

      const response = await controller.getByTransaction(user, transactionId);

      expect(getUseCase.execute).toHaveBeenCalledWith({
        userId: user.id,
        transactionId,
      });
      expect(response.object).toBe(RESPONSE_OBJECT_TYPES.FISCAL_NOTE_ITEM);
      expect(response.transactionId).toBe(transactionId);
    });
  });

  describe('unlink', () => {
    it('delegates to UnlinkTransactionFiscalNoteUseCase', async () => {
      unlinkUseCase.execute.mockResolvedValue(undefined);

      await controller.unlink(user, transactionId);

      expect(unlinkUseCase.execute).toHaveBeenCalledWith({
        userId: user.id,
        transactionId,
      });
    });
  });
});
