import { SEFAZ_CE_PARSER_VERSION } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNoteItem } from '@/modules/fiscal-notes/domain/entities/fiscal-note-item.entity';
import { FiscalNotePayment } from '@/modules/fiscal-notes/domain/entities/fiscal-note-payment.entity';
import { CreateFiscalNoteProps, FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import { InvalidFiscalNoteError } from '@/modules/fiscal-notes/domain/errors';
import { randomUUID } from 'node:crypto';

const VALID_ACCESS_KEY = '23261003539462000250651030000760541443208780';
const VALID_CNPJ = '03539462000250';

function buildValidNoteProps(overrides: Partial<CreateFiscalNoteProps> = {}): CreateFiscalNoteProps {
  const noteId = overrides.id ?? randomUUID();

  return {
    id: noteId,
    userId: randomUUID(),
    transactionId: randomUUID(),
    accessKey: VALID_ACCESS_KEY,
    sourceUf: '23',
    number: '76054',
    series: '103',
    issuedAt: new Date('2026-10-15T18:30:00.000Z'),
    protocol: '223260000000001',
    issuerName: 'SUPERMERCADO EXEMPLO LTDA',
    issuerCnpj: VALID_CNPJ,
    issuerAddress: 'Av. Bezerra de Menezes, 1000',
    grossAmountCents: 1500,
    discountAmountCents: 100,
    payableAmountCents: 1400,
    taxAmountCents: 210,
    changeAmountCents: null,
    xmlVersion: '4.00',
    xsltVersion: '2.05',
    parserVersion: SEFAZ_CE_PARSER_VERSION,
    items: [
      FiscalNoteItem.create({
        fiscalNoteId: noteId,
        position: 1,
        rawDescription: 'CAFE TORRADO 500G',
        storeCode: '1234',
        unit: 'UN',
        quantity: 1,
        unitPrice: 15,
        totalPriceCents: 1500,
      }),
    ],
    payments: [
      FiscalNotePayment.create({
        fiscalNoteId: noteId,
        position: 1,
        methodLabel: 'PIX',
        amountCents: 1400,
      }),
    ],
    ...overrides,
  };
}

describe('FiscalNote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a valid FiscalNote with items and payments', () => {
      const props = buildValidNoteProps();
      const note = FiscalNote.create(props);

      expect(note.id).toBe(props.id);
      expect(note.accessKey).toBe(VALID_ACCESS_KEY);
      expect(note.payableAmountCents).toBe(1400);
      expect(note.changeAmountCents).toBeNull();
      expect(note.isDeleted).toBe(false);
      expect(note.deletedAt).toBeNull();
      expect(note.items).toHaveLength(1);
      expect(note.payments).toHaveLength(1);
    });

    it('should accept 1 cent tolerance between (gross - discount) and payable', () => {
      const note = FiscalNote.create(
        buildValidNoteProps({
          grossAmountCents: 1500,
          discountAmountCents: 100,
          payableAmountCents: 1401,
        }),
      );

      expect(note.payableAmountCents).toBe(1401);
    });

    it('should reject arithmetic mismatch exceeding 1 cent tolerance', () => {
      expect(() =>
        FiscalNote.create(
          buildValidNoteProps({
            grossAmountCents: 1500,
            discountAmountCents: 100,
            payableAmountCents: 1402,
          }),
        ),
      ).toThrow(InvalidFiscalNoteError);
    });

    it('should reject invalid accessKey, sourceUf, or issuerCnpj', () => {
      expect(() => FiscalNote.create(buildValidNoteProps({ accessKey: '123' }))).toThrow(InvalidFiscalNoteError);
      expect(() => FiscalNote.create(buildValidNoteProps({ sourceUf: '2' }))).toThrow(InvalidFiscalNoteError);
      expect(() => FiscalNote.create(buildValidNoteProps({ issuerCnpj: '123' }))).toThrow(InvalidFiscalNoteError);
    });

    it('should reject negative or non-integer monetary values', () => {
      expect(() => FiscalNote.create(buildValidNoteProps({ grossAmountCents: -1 }))).toThrow(InvalidFiscalNoteError);
      expect(() => FiscalNote.create(buildValidNoteProps({ payableAmountCents: 10.5 }))).toThrow(
        InvalidFiscalNoteError,
      );
      expect(() => FiscalNote.create(buildValidNoteProps({ changeAmountCents: -5 }))).toThrow(InvalidFiscalNoteError);
    });

    it('should reject fiscal note with zero items or duplicate positions', () => {
      expect(() => FiscalNote.create(buildValidNoteProps({ items: [] }))).toThrow(InvalidFiscalNoteError);

      const noteId = randomUUID();
      const duplicateItem1 = FiscalNoteItem.create({
        fiscalNoteId: noteId,
        position: 1,
        rawDescription: 'ITEM A',
        storeCode: null,
        unit: 'UN',
        quantity: 1,
        unitPrice: 5,
        totalPriceCents: 500,
      });
      const duplicateItem2 = FiscalNoteItem.create({
        fiscalNoteId: noteId,
        position: 1,
        rawDescription: 'ITEM B',
        storeCode: null,
        unit: 'UN',
        quantity: 1,
        unitPrice: 10,
        totalPriceCents: 1000,
      });

      expect(() =>
        FiscalNote.create(buildValidNoteProps({ id: noteId, items: [duplicateItem1, duplicateItem2] })),
      ).toThrow(InvalidFiscalNoteError);
    });
  });

  describe('FiscalNoteItem & FiscalNotePayment invariants', () => {
    it('should reject invalid item fields', () => {
      expect(() =>
        FiscalNoteItem.create({
          fiscalNoteId: randomUUID(),
          position: 0,
          rawDescription: 'ITEM',
          storeCode: null,
          unit: 'UN',
          quantity: 1,
          unitPrice: 10,
          totalPriceCents: 1000,
        }),
      ).toThrow(InvalidFiscalNoteError);

      expect(() =>
        FiscalNoteItem.create({
          fiscalNoteId: randomUUID(),
          position: 1,
          rawDescription: '   ',
          storeCode: null,
          unit: 'UN',
          quantity: 1,
          unitPrice: 10,
          totalPriceCents: 1000,
        }),
      ).toThrow(InvalidFiscalNoteError);

      expect(() =>
        FiscalNoteItem.create({
          fiscalNoteId: randomUUID(),
          position: 1,
          rawDescription: 'ITEM',
          storeCode: null,
          unit: '',
          quantity: 1,
          unitPrice: 10,
          totalPriceCents: 1000,
        }),
      ).toThrow(InvalidFiscalNoteError);

      expect(() =>
        FiscalNoteItem.create({
          fiscalNoteId: randomUUID(),
          position: 1,
          rawDescription: 'ITEM',
          storeCode: null,
          unit: 'KG',
          quantity: 0,
          unitPrice: 10,
          totalPriceCents: 1000,
        }),
      ).toThrow(InvalidFiscalNoteError);

      expect(() =>
        FiscalNoteItem.create({
          fiscalNoteId: randomUUID(),
          position: 1,
          rawDescription: 'ITEM',
          storeCode: null,
          unit: 'KG',
          quantity: 1,
          unitPrice: -0.01,
          totalPriceCents: 1000,
        }),
      ).toThrow(InvalidFiscalNoteError);

      expect(() =>
        FiscalNoteItem.create({
          fiscalNoteId: randomUUID(),
          position: 1,
          rawDescription: 'ITEM',
          storeCode: null,
          unit: 'KG',
          quantity: 1,
          unitPrice: 10,
          totalPriceCents: 10.5,
        }),
      ).toThrow(InvalidFiscalNoteError);
    });

    it('should reject invalid payment fields', () => {
      expect(() =>
        FiscalNotePayment.create({
          fiscalNoteId: randomUUID(),
          position: 0,
          methodLabel: 'PIX',
          amountCents: 100,
        }),
      ).toThrow(InvalidFiscalNoteError);

      expect(() =>
        FiscalNotePayment.create({
          fiscalNoteId: randomUUID(),
          position: 1,
          methodLabel: ' ',
          amountCents: 100,
        }),
      ).toThrow(InvalidFiscalNoteError);

      expect(() =>
        FiscalNotePayment.create({
          fiscalNoteId: randomUUID(),
          position: 1,
          methodLabel: 'PIX',
          amountCents: -1,
        }),
      ).toThrow(InvalidFiscalNoteError);
    });
  });

  describe('softDelete', () => {
    it('should mark the fiscal note as deleted idempotently', () => {
      const note = FiscalNote.create(buildValidNoteProps());
      const firstDeleteAt = new Date('2026-10-16T12:00:00.000Z');
      const secondDeleteAt = new Date('2026-10-17T12:00:00.000Z');

      note.softDelete(firstDeleteAt);
      expect(note.isDeleted).toBe(true);
      expect(note.deletedAt).toEqual(firstDeleteAt);
      expect(note.updatedAt).toEqual(firstDeleteAt);

      note.softDelete(secondDeleteAt);
      expect(note.deletedAt).toEqual(firstDeleteAt);
    });
  });
});
