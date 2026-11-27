import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { ListFiscalNotesResponseDto } from '@/modules/fiscal-notes/presentation/dto/list-fiscal-notes.response.dto';

describe('ListFiscalNotesResponseDto', () => {
  it('maps items with fiscal_note.summary without items/payments arrays and sets summary_totals', () => {
    const issuedAt = new Date('2026-10-16T01:15:30.000Z');
    const createdAt = new Date('2026-10-16T01:20:00.000Z');
    const updatedAt = new Date('2026-10-16T01:20:00.000Z');

    const response = ListFiscalNotesResponseDto.fromUseCaseOutput({
      items: [
        {
          id: '55555555-5555-4555-a555-555555555555',
          transactionId: '44444444-4444-4444-a444-444444444444',
          accessKey: '23261003539462000250651030000760541443208780',
          sourceUf: '23',
          number: '76054',
          series: '103',
          issuedAt,
          issuerName: 'SUPERMERCADO EXEMPLO LTDA',
          issuerCnpj: '03539462000250',
          grossAmountCents: 4013,
          discountAmountCents: 872,
          payableAmountCents: 3141,
          taxAmountCents: 1051,
          itemsCount: 6,
          createdAt,
          updatedAt,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      summary: {
        totalNotes: 1,
        totalGrossAmountCents: 4013,
        totalDiscountAmountCents: 872,
        totalPayableAmountCents: 3141,
        totalTaxAmountCents: 1051,
      },
    });

    expect(response.object).toBe(RESPONSE_OBJECT_TYPES.FISCAL_NOTE_LIST);
    expect(response.meta).toEqual({
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    expect(response.summary).toEqual({
      object: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_SUMMARY_TOTALS,
      totalNotes: 1,
      totalGrossAmountCents: 4013,
      totalDiscountAmountCents: 872,
      totalPayableAmountCents: 3141,
      totalTaxAmountCents: 1051,
    });
    expect(response.data).toHaveLength(1);
    expect(response.data[0]).toEqual({
      object: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_SUMMARY,
      id: '55555555-5555-4555-a555-555555555555',
      transactionId: '44444444-4444-4444-a444-444444444444',
      accessKey: '23261003539462000250651030000760541443208780',
      sourceUf: '23',
      number: '76054',
      series: '103',
      issuedAt,
      issuerName: 'SUPERMERCADO EXEMPLO LTDA',
      issuerCnpj: '03539462000250',
      grossAmountCents: 4013,
      discountAmountCents: 872,
      payableAmountCents: 3141,
      taxAmountCents: 1051,
      itemsCount: 6,
      createdAt,
      updatedAt,
    });
    expect(response.data[0]).not.toHaveProperty('items');
    expect(response.data[0]).not.toHaveProperty('payments');
  });
});
