import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { ListFiscalNotesOutput } from '@/modules/fiscal-notes/application/use-cases/list-fiscal-notes/list-fiscal-notes.dto';
import { FiscalNoteSummaryResponseDto } from '@/modules/fiscal-notes/presentation/dto/fiscal-note-summary.response.dto';
import { ApiProperty } from '@nestjs/swagger';

class ListFiscalNotesMetaDto {
  @ApiProperty({ example: 25 })
  readonly total: number;

  @ApiProperty({ example: 1 })
  readonly page: number;

  @ApiProperty({ example: 20 })
  readonly limit: number;

  @ApiProperty({ example: 2 })
  readonly totalPages: number;

  @ApiProperty({ example: true })
  readonly hasNextPage: boolean;

  @ApiProperty({ example: false })
  readonly hasPreviousPage: boolean;
}

class ListFiscalNotesSummaryDto {
  @ApiProperty({ example: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_SUMMARY_TOTALS })
  readonly object: typeof RESPONSE_OBJECT_TYPES.FISCAL_NOTE_SUMMARY_TOTALS;

  @ApiProperty({ example: 25 })
  readonly totalNotes: number;

  @ApiProperty({ example: 120000 })
  readonly totalGrossAmountCents: number;

  @ApiProperty({ example: 15000 })
  readonly totalDiscountAmountCents: number;

  @ApiProperty({ example: 105000 })
  readonly totalPayableAmountCents: number;

  @ApiProperty({ example: 21000 })
  readonly totalTaxAmountCents: number;
}

export class ListFiscalNotesResponseDto {
  @ApiProperty({ example: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_LIST })
  readonly object: typeof RESPONSE_OBJECT_TYPES.FISCAL_NOTE_LIST;

  @ApiProperty({ type: [FiscalNoteSummaryResponseDto] })
  readonly data: FiscalNoteSummaryResponseDto[];

  @ApiProperty({ type: ListFiscalNotesMetaDto })
  readonly meta: ListFiscalNotesMetaDto;

  @ApiProperty({ type: ListFiscalNotesSummaryDto })
  readonly summary: ListFiscalNotesSummaryDto;

  static fromUseCaseOutput(output: ListFiscalNotesOutput): ListFiscalNotesResponseDto {
    return {
      object: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_LIST,
      data: output.items.map(item => FiscalNoteSummaryResponseDto.fromListItem(item)),
      meta: {
        total: output.total,
        page: output.page,
        limit: output.limit,
        totalPages: output.totalPages,
        hasNextPage: output.hasNextPage,
        hasPreviousPage: output.hasPreviousPage,
      },
      summary: {
        object: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_SUMMARY_TOTALS,
        totalNotes: output.summary.totalNotes,
        totalGrossAmountCents: output.summary.totalGrossAmountCents,
        totalDiscountAmountCents: output.summary.totalDiscountAmountCents,
        totalPayableAmountCents: output.summary.totalPayableAmountCents,
        totalTaxAmountCents: output.summary.totalTaxAmountCents,
      },
    };
  }
}
