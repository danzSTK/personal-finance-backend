import {
  FiscalNoteCancelledOrDeniedError,
  FiscalNoteParseFailedError,
  FiscalNoteSefazNotFoundError,
} from '@/modules/fiscal-notes/application/errors';
import {
  FiscalNoteSupportedUfs,
  SEFAZ_CE_PARSER_VERSION,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNoteHomologationNotAllowedError } from '@/modules/fiscal-notes/domain/errors';
import { SefazCeHtmlParser } from '@/modules/fiscal-notes/infrastructure/providers/sefaz-ce/sefaz-ce-html.parser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const VALID_CE_KEY = '23261003539462000250651030000760541443208780';

function readFixture(name: string): string {
  return readFileSync(join(__dirname, '__fixtures__', name), 'utf8');
}

describe('SefazCeHtmlParser', () => {
  let parser: SefazCeHtmlParser;

  beforeEach(() => {
    jest.clearAllMocks();
    parser = new SefazCeHtmlParser();
  });

  describe('parseBusinessError', () => {
    it('decodes malformed HTML entities and maps not-found error', () => {
      expect(() => parser.parseBusinessError('100 - QR Code Inv&aacutelido')).toThrow(FiscalNoteSefazNotFoundError);
    });

    it('maps cancelled or denied business errors', () => {
      expect(() => parser.parseBusinessError('Nota Fiscal Cancelada')).toThrow(FiscalNoteCancelledOrDeniedError);
      expect(() => parser.parseBusinessError('Uso Denegado')).toThrow(FiscalNoteCancelledOrDeniedError);
    });

    it('maps homologation business errors with malformed entities', () => {
      expect(() => parser.parseBusinessError('Emitida em ambiente de homologa&ccedil&atildeo')).toThrow(
        FiscalNoteHomologationNotAllowedError,
      );
    });
  });

  describe('parseHtml', () => {
    it('parses complete 6-item fixture with discount, NaN change, civil issuedDate, and strips Consumidor PII', () => {
      const html = readFixture('sefaz-ce-complete-with-discount-and-consumer.html');
      const parsed = parser.parseHtml(html, VALID_CE_KEY);

      expect(parsed.accessKey).toBe(VALID_CE_KEY);
      expect(parsed.sourceUf).toBe(FiscalNoteSupportedUfs.CE);
      expect(parsed.number).toBe('76054');
      expect(parsed.series).toBe('103');
      expect(parsed.issuedDate).toBe('2026-10-15');
      expect(parsed.issuedAt.toISOString()).toBe('2026-10-16T01:15:30.000Z');
      expect(parsed.protocol).toBe('223260123456789');
      expect(parsed.issuerName).toBe('SUPERMERCADO EXEMPLO FORTALEZA LTDA');
      expect(parsed.issuerCnpj).toBe('03539462000250');
      expect(parsed.issuerAddress).toBe('AV BEZERRA DE MENEZES, 1000, SAO GERARDO, FORTALEZA, CE');
      expect(parsed.grossAmountCents).toBe(4013);
      expect(parsed.discountAmountCents).toBe(872);
      expect(parsed.payableAmountCents).toBe(3141);
      expect(parsed.taxAmountCents).toBe(1051);
      expect(parsed.changeAmountCents).toBeNull();
      expect(parsed.xmlVersion).toBe('4.00');
      expect(parsed.xsltVersion).toBe('2.05');
      expect(parsed.parserVersion).toBe(SEFAZ_CE_PARSER_VERSION);

      expect(parsed.items).toHaveLength(6);
      expect(parsed.items[0]).toEqual({
        position: 1,
        rawDescription: 'QUEIJO MUSSARELA FATIADO',
        storeCode: '1001',
        unit: 'KG',
        quantity: 0.468,
        unitPrice: 26.99,
        totalPriceCents: 1263,
      });
      expect(parsed.items[2].storeCode).toBeNull();
      expect(parsed.items[3].storeCode).toBeNull();

      expect(parsed.payments).toEqual([
        {
          position: 1,
          methodLabel: 'Cartão de Débito',
          amountCents: 3141,
        },
      ]);

      const serialized = JSON.stringify(parsed);
      expect(serialized).not.toContain('123.456.789-00');
      expect(serialized).not.toContain('12345678900');
      expect(serialized).not.toContain('JOAO FULANO');
      expect(serialized).not.toContain('RUA PRIVADA');
    });

    it('parses multiple payments and numeric change amount in cents', () => {
      const html = readFixture('sefaz-ce-multi-payment-with-change.html');
      const parsed = parser.parseHtml(html, VALID_CE_KEY);

      expect(parsed.issuedDate).toBe('2026-11-20');
      expect(parsed.issuedAt.toISOString()).toBe('2026-11-20T12:05:00.000Z');
      expect(parsed.changeAmountCents).toBe(500);
      expect(parsed.payments).toEqual([
        { position: 1, methodLabel: 'PIX', amountCents: 1500 },
        { position: 2, methodLabel: 'Dinheiro', amountCents: 2000 },
      ]);
    });

    it('derives grossAmountCents from payableAmountCents when Valor total and Descontos are omitted', () => {
      const html = readFixture('sefaz-ce-no-discount-no-gross.html');
      const parsed = parser.parseHtml(html, VALID_CE_KEY);

      expect(parsed.grossAmountCents).toBe(1700);
      expect(parsed.discountAmountCents).toBe(0);
      expect(parsed.payableAmountCents).toBe(1700);
      expect(parsed.taxAmountCents).toBe(0);
      expect(parsed.changeAmountCents).toBeNull();
      expect(parsed.issuerAddress).toBeNull();
    });

    it('throws FiscalNoteCancelledOrDeniedError for cancelled HTML banner', () => {
      const html = readFixture('sefaz-ce-cancelled.html');
      expect(() => parser.parseHtml(html, VALID_CE_KEY)).toThrow(FiscalNoteCancelledOrDeniedError);
    });

    it('throws FiscalNoteHomologationNotAllowedError for homologation HTML', () => {
      const html = readFixture('sefaz-ce-no-discount-no-gross.html').replace(
        'Número: 456',
        'EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL Número: 456',
      );
      expect(() => parser.parseHtml(html, VALID_CE_KEY)).toThrow(FiscalNoteHomologationNotAllowedError);
    });

    it('throws FiscalNoteParseFailedError for broken HTML layout or divergent access key', () => {
      const brokenHtml = readFixture('sefaz-ce-broken.html');
      expect(() => parser.parseHtml(brokenHtml, VALID_CE_KEY)).toThrow(FiscalNoteParseFailedError);

      const validHtml = readFixture('sefaz-ce-no-discount-no-gross.html');
      const otherKey = '23261003539462000250651030000760541443208781';
      expect(() => parser.parseHtml(validHtml, otherKey)).toThrow(FiscalNoteParseFailedError);
    });

    it('throws FiscalNoteParseFailedError when totals arithmetic differs by more than 1 cent', () => {
      const tamperedHtml = readFixture('sefaz-ce-complete-with-discount-and-consumer.html').replace('40,13', '45,00');
      expect(() => parser.parseHtml(tamperedHtml, VALID_CE_KEY)).toThrow(FiscalNoteParseFailedError);
    });

    it('accepts quantity and unitPrice with 1, 2, 3, and 4 decimal places within NUMERIC(12, 4)', () => {
      const baseHtml = readFixture('sefaz-ce-no-discount-no-gross.html');

      const withOneAndTwoDecimals = baseHtml
        .replace('<strong>Qtde.:</strong>&nbsp;2', '<strong>Qtde.:</strong>&nbsp;1,5')
        .replace('<strong>Vl. Unit.:</strong>&nbsp;8,50', '<strong>Vl. Unit.:</strong>&nbsp;11,33');
      const parsedOneTwo = parser.parseHtml(withOneAndTwoDecimals, VALID_CE_KEY);
      expect(parsedOneTwo.items[0].quantity).toBe(1.5);
      expect(parsedOneTwo.items[0].unitPrice).toBe(11.33);

      const withThreeAndFourDecimals = baseHtml
        .replace('<strong>Qtde.:</strong>&nbsp;2', '<strong>Qtde.:</strong>&nbsp;0,352')
        .replace('<strong>Vl. Unit.:</strong>&nbsp;8,50', '<strong>Vl. Unit.:</strong>&nbsp;1,2500');
      const parsedThreeFour = parser.parseHtml(withThreeAndFourDecimals, VALID_CE_KEY);
      expect(parsedThreeFour.items[0].quantity).toBe(0.352);
      expect(parsedThreeFour.items[0].unitPrice).toBe(1.25);

      const withMaxFourDecimals = baseHtml
        .replace('<strong>Qtde.:</strong>&nbsp;2', '<strong>Qtde.:</strong>&nbsp;99.999.999,9999')
        .replace('<strong>Vl. Unit.:</strong>&nbsp;8,50', '<strong>Vl. Unit.:</strong>&nbsp;5,899');
      const parsedMax = parser.parseHtml(withMaxFourDecimals, VALID_CE_KEY);
      expect(parsedMax.items[0].quantity).toBe(99999999.9999);
      expect(parsedMax.items[0].unitPrice).toBe(5.899);
    });

    it('throws FiscalNoteParseFailedError when quantity or unitPrice exceeds NUMERIC(12, 4) bounds', () => {
      const baseHtml = readFixture('sefaz-ce-no-discount-no-gross.html');

      const fiveDecimalQuantityHtml = baseHtml.replace(
        '<strong>Qtde.:</strong>&nbsp;2',
        '<strong>Qtde.:</strong>&nbsp;1,23456',
      );
      expect(() => parser.parseHtml(fiveDecimalQuantityHtml, VALID_CE_KEY)).toThrow(FiscalNoteParseFailedError);

      const fiveDecimalUnitPriceHtml = baseHtml.replace(
        '<strong>Vl. Unit.:</strong>&nbsp;8,50',
        '<strong>Vl. Unit.:</strong>&nbsp;10,12345',
      );
      expect(() => parser.parseHtml(fiveDecimalUnitPriceHtml, VALID_CE_KEY)).toThrow(FiscalNoteParseFailedError);

      const nineIntegerDigitsQuantityHtml = baseHtml.replace(
        '<strong>Qtde.:</strong>&nbsp;2',
        '<strong>Qtde.:</strong>&nbsp;100000000,00',
      );
      expect(() => parser.parseHtml(nineIntegerDigitsQuantityHtml, VALID_CE_KEY)).toThrow(FiscalNoteParseFailedError);

      const nineIntegerDigitsUnitPriceHtml = baseHtml.replace(
        '<strong>Vl. Unit.:</strong>&nbsp;8,50',
        '<strong>Vl. Unit.:</strong>&nbsp;100.000.000,00',
      );
      expect(() => parser.parseHtml(nineIntegerDigitsUnitPriceHtml, VALID_CE_KEY)).toThrow(FiscalNoteParseFailedError);
    });
  });
});
