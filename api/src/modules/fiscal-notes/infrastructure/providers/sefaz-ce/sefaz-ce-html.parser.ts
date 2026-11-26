import { DateOnlyString, isValidDateOnly, toDateOnly } from '@/common/utils/date-only';
import {
  FiscalNoteCancelledOrDeniedError,
  FiscalNoteHomologationNotAllowedError,
  FiscalNoteParseFailedError,
  FiscalNoteSefazNotFoundError,
} from '@/modules/fiscal-notes/application/errors';
import {
  ParsedFiscalNoteData,
  ParsedFiscalNoteItemData,
  ParsedFiscalNotePaymentData,
} from '@/modules/fiscal-notes/application/ports/fiscal-note-provider.port';
import {
  FISCAL_NOTE_CNPJ_REGEX,
  FISCAL_NOTE_TOTAL_TOLERANCE_CENTS,
  FiscalNoteSupportedUfs,
  SEFAZ_CE_CONSUMER_SECTION_KEYWORD,
  SEFAZ_CE_DEFAULT_UNIT,
  SEFAZ_CE_GENERAL_INFO_SECTION_KEYWORD,
  SEFAZ_CE_NAN_TEXT,
  SEFAZ_CE_PARSER_VERSION,
  SEFAZ_CE_TIMEZONE_OFFSET,
  SefazCeStatusKeywords,
  SefazCeTotalLabels,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio/slim';

const NON_DIGIT_REGEX = /\D/g;
const WHITESPACE_REGEX = /\s+/g;
const DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const CNPJ_EXTRACT_REGEX = /cnpj\s*:\s*([\d.\-/ ]+)/i;
const STORE_CODE_EXTRACT_REGEX = /c[oó]digo\s*:\s*([^)]*)/i;
const UNIT_EXTRACT_REGEX = /un\s*:\s*(.*)/i;
const LABEL_PREFIX_REGEX = /^[^:]*:\s*/;
const PT_BR_DECIMAL_REGEX = /^\d+(?:\.\d{3})*(?:,\d+)?$|^\d+(?:,\d+)?$/;
const PT_BR_MONEY_REGEX = /^(\d+(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/;
const NUMBER_EXTRACT_REGEX = /n[uú]mero\s*:\s*(\d+)/i;
const SERIES_EXTRACT_REGEX = /s[eé]rie\s*:\s*(\d+)/i;
const ISSUED_AT_EXTRACT_REGEX =
  /emiss[aã]o\s*:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})(?:\s*([+-]\d{2}:\d{2}))?/i;
const PROTOCOL_EXTRACT_REGEX = /protocolo\s+de\s+autoriza[cç][aã]o\s*:\s*(\d+)/i;
const XML_VERSION_EXTRACT_REGEX = /vers[aã]o\s+xml\s*:\s*([0-9]+(?:\.[0-9]+)*)/i;
const XSLT_VERSION_EXTRACT_REGEX = /vers[aã]o\s+xslt\s*:\s*([0-9]+(?:\.[0-9]+)*)/i;
const PAYMENT_HEADER_KEYWORD = 'forma de pagamento';

@Injectable()
export class SefazCeHtmlParser {
  parseBusinessError(rawError: string): never {
    const decoded = cheerio.load(rawError).text().replace(WHITESPACE_REGEX, ' ').trim();
    const normalized = this.normalizeForMatch(decoded);

    if (normalized.includes(SefazCeStatusKeywords.CANCELLED) || normalized.includes(SefazCeStatusKeywords.DENIED)) {
      throw new FiscalNoteCancelledOrDeniedError();
    }

    if (
      normalized.includes(SefazCeStatusKeywords.HOMOLOGATION) ||
      normalized.includes(SefazCeStatusKeywords.NO_FISCAL_VALUE)
    ) {
      throw new FiscalNoteHomologationNotAllowedError();
    }

    throw new FiscalNoteSefazNotFoundError();
  }

  parseHtml(html: string, requestedAccessKey: string): ParsedFiscalNoteData {
    if (typeof html !== 'string' || html.trim().length === 0) {
      throw new FiscalNoteParseFailedError('SEFAZ-CE HTML payload is empty.');
    }

    const $ = cheerio.load(html);

    // LGPD/Zero-PII: strip any consumer section before reading or checking anything else.
    this.removeConsumerSections($);
    this.assertFiscalStatusAllowed($);

    const extractedAccessKey = $('span.chave').first().text().replace(NON_DIGIT_REGEX, '');
    if (extractedAccessKey !== requestedAccessKey) {
      throw new FiscalNoteParseFailedError('Extracted fiscal note access key does not match requested access key.');
    }

    const issuer = this.extractIssuer($);
    const items = this.extractItems($);
    const { totals, payments } = this.extractTotalsAndPayments($);
    const generalInfo = this.extractGeneralInfo($);

    this.validateIntegrity({
      issuerName: issuer.issuerName,
      issuerCnpj: issuer.issuerCnpj,
      items,
      payments,
      grossAmountCents: totals.grossAmountCents,
      discountAmountCents: totals.discountAmountCents,
      payableAmountCents: totals.payableAmountCents,
      taxAmountCents: totals.taxAmountCents,
      changeAmountCents: totals.changeAmountCents,
      number: generalInfo.number,
      series: generalInfo.series,
      issuedAt: generalInfo.issuedAt,
      issuedDate: generalInfo.issuedDate,
    });

    return {
      accessKey: extractedAccessKey,
      sourceUf: FiscalNoteSupportedUfs.CE,
      number: generalInfo.number,
      series: generalInfo.series,
      issuedAt: generalInfo.issuedAt,
      issuedDate: generalInfo.issuedDate,
      protocol: generalInfo.protocol,
      issuerName: issuer.issuerName,
      issuerCnpj: issuer.issuerCnpj,
      issuerAddress: issuer.issuerAddress,
      grossAmountCents: totals.grossAmountCents,
      discountAmountCents: totals.discountAmountCents,
      payableAmountCents: totals.payableAmountCents,
      taxAmountCents: totals.taxAmountCents,
      changeAmountCents: totals.changeAmountCents,
      xmlVersion: generalInfo.xmlVersion,
      xsltVersion: generalInfo.xsltVersion,
      parserVersion: SEFAZ_CE_PARSER_VERSION,
      items,
      payments,
    };
  }

  private removeConsumerSections($: cheerio.CheerioAPI): void {
    $('[data-role="collapsible"]').each((_, element) => {
      const heading = this.normalizeForMatch($(element).find('h4').first().text());
      if (heading.includes(SEFAZ_CE_CONSUMER_SECTION_KEYWORD)) {
        $(element).remove();
      }
    });
  }

  private assertFiscalStatusAllowed($: cheerio.CheerioAPI): void {
    const statusScope = $.root().clone();
    statusScope.find('table#tabResult').remove();
    const normalizedText = this.normalizeForMatch(statusScope.text());

    if (
      normalizedText.includes(SefazCeStatusKeywords.CANCELLED) ||
      normalizedText.includes(SefazCeStatusKeywords.DENIED)
    ) {
      throw new FiscalNoteCancelledOrDeniedError();
    }

    if (
      normalizedText.includes(SefazCeStatusKeywords.HOMOLOGATION) ||
      normalizedText.includes(SefazCeStatusKeywords.NO_FISCAL_VALUE)
    ) {
      throw new FiscalNoteHomologationNotAllowedError();
    }
  }

  private extractIssuer($: cheerio.CheerioAPI): {
    issuerName: string;
    issuerCnpj: string;
    issuerAddress: string | null;
  } {
    const rawName = $('#u20').first().text() || $('div.txtTopo').first().text();
    const issuerName = this.normalizeWhitespace(rawName);

    const textBlocks = $('.txtCenter div.text').length > 0 ? $('.txtCenter div.text') : $('div.text');
    let issuerCnpj = '';
    let issuerAddress: string | null = null;

    textBlocks.each((_, element) => {
      const blockText = this.normalizeWhitespace($(element).text());
      if (!blockText) {
        return;
      }

      const cnpjMatch = CNPJ_EXTRACT_REGEX.exec(blockText);
      if (cnpjMatch && !issuerCnpj) {
        issuerCnpj = cnpjMatch[1].replace(NON_DIGIT_REGEX, '');
        return;
      }

      if (!issuerAddress) {
        issuerAddress = blockText.replace(/\s*,\s*/g, ', ').trim() || null;
      }
    });

    return {
      issuerName,
      issuerCnpj,
      issuerAddress,
    };
  }

  private extractItems($: cheerio.CheerioAPI): ParsedFiscalNoteItemData[] {
    const rows = $('table#tabResult tr');
    if (rows.length === 0) {
      throw new FiscalNoteParseFailedError('Fiscal note HTML contains no item rows.');
    }

    const items: ParsedFiscalNoteItemData[] = [];

    rows.each((index, row) => {
      const $row = $(row);
      const rawDescription = this.normalizeWhitespace($row.find('span.txtTit').first().text());
      const storeCodeRaw = $row.find('span.RCod').first().text();
      const quantityRaw = $row.find('span.Rqtd').first().text();
      const unitElement = $row.find('span.RUN').first();
      const unitPriceRaw = $row.find('span.RvlUnit').first().text();
      const totalRaw = $row.find('td.txtTit.noWrap span.valor').first().text() || $row.find('span.valor').last().text();

      const storeCode = this.extractStoreCode(storeCodeRaw);
      const unit = this.extractUnit(unitElement.length > 0 ? unitElement.text() : null);
      const quantity = this.parseLabeledPtBrDecimal(quantityRaw);
      const unitPrice = this.parseLabeledPtBrDecimal(unitPriceRaw);
      const totalPriceCents = this.parsePtBrCents(totalRaw);

      if (!rawDescription || !unit || quantity === null || unitPrice === null || totalPriceCents === null) {
        throw new FiscalNoteParseFailedError(`Malformed item row at position ${index + 1}.`);
      }

      items.push({
        position: index + 1,
        rawDescription,
        storeCode,
        unit,
        quantity,
        unitPrice,
        totalPriceCents,
      });
    });

    return items;
  }

  private extractTotalsAndPayments($: cheerio.CheerioAPI): {
    totals: {
      grossAmountCents: number;
      discountAmountCents: number;
      payableAmountCents: number;
      taxAmountCents: number;
      changeAmountCents: number | null;
    };
    payments: ParsedFiscalNotePaymentData[];
  } {
    let grossAmountCents: number | null = null;
    let discountAmountCents: number | null = null;
    let payableAmountCents: number | null = null;
    let taxAmountCents: number | null = null;
    let changeAmountCents: number | null = null;
    const payments: ParsedFiscalNotePaymentData[] = [];

    let inPaymentsSection = false;

    for (const element of $('#totalNota > div').toArray()) {
      const $row = $(element);
      const $label = $row.find('label').first();
      const $value = $row.find('span.totalNumb').first();
      const rawLabel = this.normalizeWhitespace($label.text());
      const normLabel = this.normalizeForMatch(rawLabel);
      const rawValue = this.normalizeWhitespace($value.text());

      if ($row.attr('id') === 'linhaForma' || normLabel.includes(PAYMENT_HEADER_KEYWORD)) {
        inPaymentsSection = true;
        continue;
      }

      if (normLabel.includes(SefazCeTotalLabels.TROCO)) {
        inPaymentsSection = false;
        if (!rawValue || this.normalizeForMatch(rawValue) === SEFAZ_CE_NAN_TEXT) {
          changeAmountCents = null;
          continue;
        }

        const parsedChange = this.parsePtBrCents(rawValue);
        if (parsedChange === null) {
          throw new FiscalNoteParseFailedError('Invalid fiscal note change amount.');
        }

        changeAmountCents = parsedChange;
        continue;
      }

      if (normLabel.includes(SefazCeTotalLabels.TRIBUTO) || $label.hasClass('txtObs')) {
        inPaymentsSection = false;
        if (rawValue) {
          const parsedTax = this.parsePtBrCents(rawValue);
          if (parsedTax === null) {
            throw new FiscalNoteParseFailedError('Invalid fiscal note tax amount.');
          }
          taxAmountCents = parsedTax;
        }
        continue;
      }

      if (inPaymentsSection) {
        if (rawLabel && rawValue) {
          const parsedPaymentCents = this.parsePtBrCents(rawValue);
          if (parsedPaymentCents === null) {
            throw new FiscalNoteParseFailedError('Invalid fiscal note payment amount.');
          }

          payments.push({
            position: payments.length + 1,
            methodLabel: rawLabel,
            amountCents: parsedPaymentCents,
          });
        }
        continue;
      }

      if (normLabel.includes(SefazCeTotalLabels.VALOR_TOTAL)) {
        grossAmountCents = this.parseRequiredCents(rawValue, 'grossAmountCents');
        continue;
      }

      if (normLabel.includes(SefazCeTotalLabels.DESCONTO)) {
        discountAmountCents = this.parseRequiredCents(rawValue, 'discountAmountCents');
        continue;
      }

      if (normLabel.includes(SefazCeTotalLabels.VALOR_A_PAGAR)) {
        payableAmountCents = this.parseRequiredCents(rawValue, 'payableAmountCents');
      }
    }

    if (payableAmountCents === null) {
      throw new FiscalNoteParseFailedError('Fiscal note payable amount is missing.');
    }

    const resolvedDiscountCents = discountAmountCents ?? 0;
    const resolvedGrossCents = grossAmountCents ?? payableAmountCents + resolvedDiscountCents;
    const resolvedTaxCents = taxAmountCents ?? 0;

    return {
      totals: {
        grossAmountCents: resolvedGrossCents,
        discountAmountCents: resolvedDiscountCents,
        payableAmountCents,
        taxAmountCents: resolvedTaxCents,
        changeAmountCents,
      },
      payments,
    };
  }

  private extractGeneralInfo($: cheerio.CheerioAPI): {
    number: string;
    series: string;
    issuedAt: Date;
    issuedDate: DateOnlyString;
    protocol: string | null;
    xmlVersion: string | null;
    xsltVersion: string | null;
  } {
    let infoText = '';

    $('[data-role="collapsible"]').each((_, element) => {
      const heading = this.normalizeForMatch($(element).find('h4').first().text());
      if (heading.includes(SEFAZ_CE_GENERAL_INFO_SECTION_KEYWORD)) {
        infoText = `${infoText} ${$(element).text()}`;
      }
    });

    if (!infoText.trim()) {
      infoText = $('#infos').text();
    }

    const normalizedInfo = this.normalizeWhitespace(infoText);
    const numberMatch = NUMBER_EXTRACT_REGEX.exec(normalizedInfo);
    const seriesMatch = SERIES_EXTRACT_REGEX.exec(normalizedInfo);
    const issuedAtMatch = ISSUED_AT_EXTRACT_REGEX.exec(normalizedInfo);

    if (!numberMatch || !seriesMatch || !issuedAtMatch) {
      throw new FiscalNoteParseFailedError('Fiscal note general information is missing required fields.');
    }

    const [, day, month, year, hour, minute, second, offset] = issuedAtMatch;
    const dateOnlyCandidate = `${year}-${month}-${day}`;
    if (!isValidDateOnly(dateOnlyCandidate)) {
      throw new FiscalNoteParseFailedError('Fiscal note issued date is invalid.');
    }

    const hourNum = Number(hour);
    const minuteNum = Number(minute);
    const secondNum = Number(second);
    if (hourNum > 23 || minuteNum > 59 || secondNum > 59) {
      throw new FiscalNoteParseFailedError('Fiscal note issued time is invalid.');
    }

    const issuedDate = toDateOnly(dateOnlyCandidate);
    const issuedAt = new Date(`${dateOnlyCandidate}T${hour}:${minute}:${second}${offset ?? SEFAZ_CE_TIMEZONE_OFFSET}`);

    if (Number.isNaN(issuedAt.getTime())) {
      throw new FiscalNoteParseFailedError('Fiscal note issuedAt timestamp is invalid.');
    }

    const protocolMatch = PROTOCOL_EXTRACT_REGEX.exec(normalizedInfo);
    const xmlVersionMatch = XML_VERSION_EXTRACT_REGEX.exec(normalizedInfo);
    const xsltVersionMatch = XSLT_VERSION_EXTRACT_REGEX.exec(normalizedInfo);

    return {
      number: numberMatch[1],
      series: seriesMatch[1],
      issuedAt,
      issuedDate,
      protocol: protocolMatch ? protocolMatch[1] : null,
      xmlVersion: xmlVersionMatch ? xmlVersionMatch[1] : null,
      xsltVersion: xsltVersionMatch ? xsltVersionMatch[1] : null,
    };
  }

  private validateIntegrity(input: {
    issuerName: string;
    issuerCnpj: string;
    items: ParsedFiscalNoteItemData[];
    payments: ParsedFiscalNotePaymentData[];
    grossAmountCents: number;
    discountAmountCents: number;
    payableAmountCents: number;
    taxAmountCents: number;
    changeAmountCents: number | null;
    number: string;
    series: string;
    issuedAt: Date;
    issuedDate: DateOnlyString;
  }): void {
    if (!input.issuerName || !FISCAL_NOTE_CNPJ_REGEX.test(input.issuerCnpj)) {
      throw new FiscalNoteParseFailedError('Fiscal note issuer metadata is invalid.');
    }

    if (
      !input.number ||
      !input.series ||
      Number.isNaN(input.issuedAt.getTime()) ||
      !isValidDateOnly(input.issuedDate)
    ) {
      throw new FiscalNoteParseFailedError('Fiscal note identification metadata is invalid.');
    }

    if (input.items.length < 1) {
      throw new FiscalNoteParseFailedError('Fiscal note must contain at least one item.');
    }

    for (const item of input.items) {
      if (
        !item.rawDescription ||
        !item.unit ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.unitPrice) ||
        item.unitPrice < 0 ||
        !Number.isSafeInteger(item.totalPriceCents) ||
        item.totalPriceCents < 0
      ) {
        throw new FiscalNoteParseFailedError(`Invalid parsed item at position ${item.position}.`);
      }
    }

    const centsValues = [
      input.grossAmountCents,
      input.discountAmountCents,
      input.payableAmountCents,
      input.taxAmountCents,
      ...input.payments.map(payment => payment.amountCents),
      ...(input.changeAmountCents !== null ? [input.changeAmountCents] : []),
    ];

    for (const cents of centsValues) {
      if (!Number.isSafeInteger(cents) || cents < 0) {
        throw new FiscalNoteParseFailedError('Invalid negative or non-integer monetary amount.');
      }
    }

    const arithmeticDiff = Math.abs(input.grossAmountCents - input.discountAmountCents - input.payableAmountCents);
    if (arithmeticDiff > FISCAL_NOTE_TOTAL_TOLERANCE_CENTS) {
      throw new FiscalNoteParseFailedError('Fiscal note totals failed arithmetic consistency check.');
    }
  }

  private extractStoreCode(raw: string): string | null {
    if (!raw) {
      return null;
    }

    const match = STORE_CODE_EXTRACT_REGEX.exec(raw);
    if (!match) {
      return null;
    }

    const cleaned = match[1].replace(/[()]/g, '').replace(WHITESPACE_REGEX, ' ').trim();
    return cleaned.length > 0 ? cleaned : null;
  }

  private extractUnit(raw: string | null): string | null {
    if (raw === null) {
      return null;
    }

    const normalized = this.normalizeWhitespace(raw);
    const match = UNIT_EXTRACT_REGEX.exec(normalized);
    if (!match) {
      return normalized.length > 0 ? normalized.toUpperCase() : null;
    }

    const unitValue = match[1].trim().toUpperCase();
    return unitValue.length > 0 ? unitValue : SEFAZ_CE_DEFAULT_UNIT;
  }

  private parseLabeledPtBrDecimal(raw: string): number | null {
    const cleaned = this.normalizeWhitespace(raw).replace(LABEL_PREFIX_REGEX, '').replace(/\s+/g, '');
    if (!cleaned || !PT_BR_DECIMAL_REGEX.test(cleaned)) {
      return null;
    }

    const parsed = Number(cleaned.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseRequiredCents(raw: string, fieldName: string): number {
    const parsed = this.parsePtBrCents(raw);
    if (parsed === null) {
      throw new FiscalNoteParseFailedError(`Invalid fiscal note monetary field: ${fieldName}.`);
    }

    return parsed;
  }

  private parsePtBrCents(raw: string): number | null {
    const cleaned = this.normalizeWhitespace(raw)
      .replace(/^R\$\s*/i, '')
      .replace(/\s+/g, '');

    if (!cleaned) {
      return null;
    }

    const match = PT_BR_MONEY_REGEX.exec(cleaned);
    if (!match) {
      return null;
    }

    const integerPart = match[1].replace(/\./g, '');
    const fractionalPart = (match[2] ?? '').padEnd(2, '0');
    const cents = Number(integerPart) * 100 + Number(fractionalPart);

    return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
  }

  private normalizeWhitespace(value: string): string {
    return value
      .replace(/\u00a0/g, ' ')
      .replace(WHITESPACE_REGEX, ' ')
      .trim();
  }

  private normalizeForMatch(value: string): string {
    return this.normalizeWhitespace(value).normalize('NFD').replace(DIACRITICS_REGEX, '').toLowerCase();
  }
}
