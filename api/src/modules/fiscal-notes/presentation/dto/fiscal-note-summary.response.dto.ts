import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { FiscalNoteListItem } from '@/modules/fiscal-notes/domain/repositories';
import { ApiProperty } from '@nestjs/swagger';

export class FiscalNoteSummaryResponseDto {
  @ApiProperty({ example: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_SUMMARY })
  readonly object: typeof RESPONSE_OBJECT_TYPES.FISCAL_NOTE_SUMMARY;

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

  @ApiProperty({ example: 'SUPERMERCADO EXEMPLO LTDA' })
  readonly issuerName: string;

  @ApiProperty({ example: '03539462000250' })
  readonly issuerCnpj: string;

  @ApiProperty({ example: 4013 })
  readonly grossAmountCents: number;

  @ApiProperty({ example: 872 })
  readonly discountAmountCents: number;

  @ApiProperty({ example: 3141 })
  readonly payableAmountCents: number;

  @ApiProperty({ example: 1051 })
  readonly taxAmountCents: number;

  @ApiProperty({ example: 6 })
  readonly itemsCount: number;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  readonly updatedAt: Date;

  static fromListItem(item: FiscalNoteListItem): FiscalNoteSummaryResponseDto {
    return {
      object: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_SUMMARY,
      id: item.id,
      transactionId: item.transactionId,
      accessKey: item.accessKey,
      sourceUf: item.sourceUf,
      number: item.number,
      series: item.series,
      issuedAt: item.issuedAt,
      issuerName: item.issuerName,
      issuerCnpj: item.issuerCnpj,
      grossAmountCents: item.grossAmountCents,
      discountAmountCents: item.discountAmountCents,
      payableAmountCents: item.payableAmountCents,
      taxAmountCents: item.taxAmountCents,
      itemsCount: item.itemsCount,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
