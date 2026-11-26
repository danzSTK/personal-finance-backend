import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import { FiscalNoteItem } from '@/modules/fiscal-notes/domain/entities/fiscal-note-item.entity';
import { FiscalNotePayment } from '@/modules/fiscal-notes/domain/entities/fiscal-note-payment.entity';
import { ApiProperty } from '@nestjs/swagger';

export class FiscalNoteItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

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

  static fromDomain(item: FiscalNoteItem): FiscalNoteItemResponseDto {
    return {
      id: item.id,
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

export class FiscalNotePaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ example: 1 })
  readonly position: number;

  @ApiProperty({ example: 'Cartão de Débito' })
  readonly methodLabel: string;

  @ApiProperty({ example: 3141 })
  readonly amountCents: number;

  static fromDomain(payment: FiscalNotePayment): FiscalNotePaymentResponseDto {
    return {
      id: payment.id,
      position: payment.position,
      methodLabel: payment.methodLabel,
      amountCents: payment.amountCents,
    };
  }
}

export class FiscalNoteResponseDto {
  @ApiProperty({ example: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_ITEM })
  readonly object: typeof RESPONSE_OBJECT_TYPES.FISCAL_NOTE_ITEM;

  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ format: 'uuid' })
  readonly transactionId: string;

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

  @ApiProperty({ type: [FiscalNoteItemResponseDto] })
  readonly items: FiscalNoteItemResponseDto[];

  @ApiProperty({ type: [FiscalNotePaymentResponseDto] })
  readonly payments: FiscalNotePaymentResponseDto[];

  @ApiProperty({ format: 'date-time' })
  readonly createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  readonly updatedAt: Date;

  static fromDomain(fiscalNote: FiscalNote): FiscalNoteResponseDto {
    return {
      object: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_ITEM,
      id: fiscalNote.id,
      transactionId: fiscalNote.transactionId,
      accessKey: fiscalNote.accessKey,
      sourceUf: fiscalNote.sourceUf,
      number: fiscalNote.number,
      series: fiscalNote.series,
      issuedAt: fiscalNote.issuedAt,
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
      items: fiscalNote.items.map(item => FiscalNoteItemResponseDto.fromDomain(item)),
      payments: fiscalNote.payments.map(payment => FiscalNotePaymentResponseDto.fromDomain(payment)),
      createdAt: fiscalNote.createdAt,
      updatedAt: fiscalNote.updatedAt,
    };
  }
}
