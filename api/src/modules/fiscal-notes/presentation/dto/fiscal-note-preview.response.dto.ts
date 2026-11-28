import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { TransactionStatus, TransactionType } from '@/common/models/enums';
import { ParsedFiscalNoteItemData, ParsedFiscalNotePaymentData } from '@/modules/fiscal-notes/application/ports';
import { PreviewFiscalNoteOutput } from '@/modules/fiscal-notes/application/use-cases/preview-fiscal-note/preview-fiscal-note.dto';
import { ApiProperty } from '@nestjs/swagger';

export class PreviewFiscalNoteItemResponseDto {
  @ApiProperty({ example: 1 })
  readonly position: number;

  @ApiProperty({ example: 'QUEIJO MUSSARELA FATIADO' })
  readonly rawDescription: string;

  @ApiProperty({ nullable: true, example: '1001' })
  readonly storeCode: string | null;

  @ApiProperty({ example: 'KG' })
  readonly unit: string;

  @ApiProperty({ example: 0.468 })
  readonly quantity: number;

  @ApiProperty({ example: 26.99 })
  readonly unitPrice: number;

  @ApiProperty({ example: 1263 })
  readonly totalPriceCents: number;

  static fromParsed(item: ParsedFiscalNoteItemData): PreviewFiscalNoteItemResponseDto {
    return {
      position: item.position,
      rawDescription: item.rawDescription,
      storeCode: item.storeCode,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPriceCents: item.totalPriceCents,
    };
  }
}

export class PreviewFiscalNotePaymentResponseDto {
  @ApiProperty({ example: 1 })
  readonly position: number;

  @ApiProperty({ example: 'Cartão de Débito' })
  readonly methodLabel: string;

  @ApiProperty({ example: 3141 })
  readonly amountCents: number;

  static fromParsed(payment: ParsedFiscalNotePaymentData): PreviewFiscalNotePaymentResponseDto {
    return {
      position: payment.position,
      methodLabel: payment.methodLabel,
      amountCents: payment.amountCents,
    };
  }
}

export class SuggestedFiscalNoteTransactionDto {
  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  readonly type: typeof TransactionType.EXPENSE;

  @ApiProperty({ enum: TransactionStatus, example: TransactionStatus.EFFECTIVE })
  readonly status: typeof TransactionStatus.EFFECTIVE;

  @ApiProperty({ example: 3141 })
  readonly amountCents: number;

  @ApiProperty({ format: 'date', example: '2026-10-15' })
  readonly date: string;

  @ApiProperty({ example: 'SUPERMERCADO EXEMPLO LTDA' })
  readonly description: string;
}

export class PreviewFiscalNoteDataDto {
  @ApiProperty({ example: '23261003539462000250651030000760541443208780' })
  readonly accessKey: string;

  @ApiProperty({ example: '23' })
  readonly sourceUf: string;

  @ApiProperty({ example: '76054' })
  readonly number: string;

  @ApiProperty({ example: '103' })
  readonly series: string;

  @ApiProperty({ format: 'date-time' })
  readonly issuedAt: Date;

  @ApiProperty({ format: 'date', example: '2026-10-15' })
  readonly issuedDate: string;

  @ApiProperty({ nullable: true, example: '223260123456789' })
  readonly protocol: string | null;

  @ApiProperty({ example: 'SUPERMERCADO EXEMPLO LTDA' })
  readonly issuerName: string;

  @ApiProperty({ example: '03539462000250' })
  readonly issuerCnpj: string;

  @ApiProperty({ nullable: true, example: 'AV BEZERRA DE MENEZES, 1000, FORTALEZA, CE' })
  readonly issuerAddress: string | null;

  @ApiProperty({ example: 4013 })
  readonly grossAmountCents: number;

  @ApiProperty({ example: 872 })
  readonly discountAmountCents: number;

  @ApiProperty({ example: 3141 })
  readonly payableAmountCents: number;

  @ApiProperty({ example: 1051 })
  readonly taxAmountCents: number;

  @ApiProperty({ nullable: true, example: null })
  readonly changeAmountCents: number | null;

  @ApiProperty({ nullable: true, example: '4.00' })
  readonly xmlVersion: string | null;

  @ApiProperty({ nullable: true, example: '2.05' })
  readonly xsltVersion: string | null;

  @ApiProperty({ example: 'sefaz-ce-html-v1' })
  readonly parserVersion: string;

  @ApiProperty({ type: [PreviewFiscalNoteItemResponseDto] })
  readonly items: PreviewFiscalNoteItemResponseDto[];

  @ApiProperty({ type: [PreviewFiscalNotePaymentResponseDto] })
  readonly payments: PreviewFiscalNotePaymentResponseDto[];
}

export class FiscalNotePreviewResponseDto {
  @ApiProperty({ example: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_PREVIEW })
  readonly object: typeof RESPONSE_OBJECT_TYPES.FISCAL_NOTE_PREVIEW;

  @ApiProperty({ example: false })
  readonly alreadyImported: boolean;

  @ApiProperty({ format: 'uuid', nullable: true, example: null })
  readonly existingTransactionId: string | null;

  @ApiProperty({ format: 'uuid', nullable: true, example: null })
  readonly existingFiscalNoteId: string | null;

  @ApiProperty({ example: false })
  readonly cacheHit: boolean;

  @ApiProperty({ type: SuggestedFiscalNoteTransactionDto })
  readonly suggestedTransaction: SuggestedFiscalNoteTransactionDto;

  @ApiProperty({ type: PreviewFiscalNoteDataDto })
  readonly fiscalNote: PreviewFiscalNoteDataDto;

  static fromOutput(output: PreviewFiscalNoteOutput): FiscalNotePreviewResponseDto {
    const { fiscalNote } = output;

    return {
      object: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_PREVIEW,
      alreadyImported: output.alreadyImported,
      existingTransactionId: output.existingTransactionId,
      existingFiscalNoteId: output.existingFiscalNoteId,
      cacheHit: output.cacheHit,
      suggestedTransaction: output.suggestedTransaction,
      fiscalNote: {
        accessKey: fiscalNote.accessKey,
        sourceUf: fiscalNote.sourceUf,
        number: fiscalNote.number,
        series: fiscalNote.series,
        issuedAt: fiscalNote.issuedAt,
        issuedDate: fiscalNote.issuedDate,
        protocol: fiscalNote.protocol,
        issuerName: fiscalNote.issuerName,
        issuerCnpj: fiscalNote.issuerCnpj,
        issuerAddress: fiscalNote.issuerAddress,
        grossAmountCents: fiscalNote.grossAmountCents,
        discountAmountCents: fiscalNote.discountAmountCents,
        payableAmountCents: fiscalNote.payableAmountCents,
        taxAmountCents: fiscalNote.taxAmountCents,
        changeAmountCents: fiscalNote.changeAmountCents,
        xmlVersion: fiscalNote.xmlVersion,
        xsltVersion: fiscalNote.xsltVersion,
        parserVersion: fiscalNote.parserVersion,
        items: fiscalNote.items.map(item => PreviewFiscalNoteItemResponseDto.fromParsed(item)),
        payments: fiscalNote.payments.map(payment => PreviewFiscalNotePaymentResponseDto.fromParsed(payment)),
      },
    };
  }
}
