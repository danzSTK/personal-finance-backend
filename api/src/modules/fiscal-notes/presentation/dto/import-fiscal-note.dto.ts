import { IsDateOnly } from '@/common/decorators/is-date-only.decorator';
import { IsOptionalButNotNull } from '@/common/decorators/is-optional-but-not-null.decorator';
import { TRANSACTION_AMOUNT_CENTS_MAX, TRANSACTION_DESCRIPTION_MAX_LENGTH } from '@/common/models/constants';
import { TransactionStatus } from '@/common/models/enums';
import type { DateOnlyString } from '@/common/utils/date-only';
import { FISCAL_NOTE_INPUT_MAX_LENGTH } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ImportFiscalNoteDto {
  @ApiProperty({
    example: 'http://nfce.sefaz.ce.gov.br/nfce/pagina?p=23261003539462000250651030000760541443208780|2|1|1|HASH',
    maxLength: FISCAL_NOTE_INPUT_MAX_LENGTH,
    description: 'URL/payload do QR Code da NFC-e ou chave de acesso de 44 dígitos',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(FISCAL_NOTE_INPUT_MAX_LENGTH)
  input: string;

  @ApiProperty({ format: 'uuid', description: 'ID da conta onde a despesa será lançada' })
  @IsUUID()
  accountId: string;

  @ApiProperty({ format: 'uuid', description: 'ID da categoria de despesa' })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({ example: 3141, description: 'Override opcional do valor em centavos' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TRANSACTION_AMOUNT_CENTS_MAX)
  @IsOptionalButNotNull()
  amountCents?: number;

  @ApiPropertyOptional({ format: 'date', example: '2026-10-15', description: 'Override opcional da data da despesa' })
  @IsDateOnly()
  @IsOptionalButNotNull()
  date?: DateOnlyString;

  @ApiPropertyOptional({ nullable: true, maxLength: TRANSACTION_DESCRIPTION_MAX_LENGTH })
  @IsString()
  @MaxLength(TRANSACTION_DESCRIPTION_MAX_LENGTH)
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ enum: TransactionStatus, default: TransactionStatus.EFFECTIVE })
  @IsEnum(TransactionStatus)
  @IsOptionalButNotNull()
  status?: TransactionStatus;
}
