import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { ImportFiscalNoteOutput } from '@/modules/fiscal-notes/application/use-cases/import-fiscal-note/import-fiscal-note.dto';
import { FiscalNoteResponseDto } from '@/modules/fiscal-notes/presentation/dto/fiscal-note.response.dto';
import { TransactionResponseDto } from '@/modules/transactions/presentation/dto/transaction.response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class ImportFiscalNoteResponseDto {
  @ApiProperty({ example: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_IMPORT })
  readonly object: typeof RESPONSE_OBJECT_TYPES.FISCAL_NOTE_IMPORT;

  @ApiProperty({ type: TransactionResponseDto })
  readonly transaction: TransactionResponseDto;

  @ApiProperty({ type: FiscalNoteResponseDto })
  readonly fiscalNote: FiscalNoteResponseDto;

  static fromOutput(output: ImportFiscalNoteOutput): ImportFiscalNoteResponseDto {
    return {
      object: RESPONSE_OBJECT_TYPES.FISCAL_NOTE_IMPORT,
      transaction: TransactionResponseDto.fromDomain(output.transaction),
      fiscalNote: FiscalNoteResponseDto.fromDomain(output.fiscalNote),
    };
  }
}
