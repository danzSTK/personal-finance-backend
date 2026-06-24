import { IsOptionalButNotNull } from '@/common/decorators/is-optional-but-not-null.decorator';
import { TRANSACTION_AMOUNT_CENTS_MAX, TRANSACTION_DESCRIPTION_MAX_LENGTH } from '@/common/models/constants';
import { TransactionDirection, TransactionType } from '@/common/models/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class UpdateTransactionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptionalButNotNull()
  accountId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptionalButNotNull()
  destinationAccountId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptionalButNotNull()
  categoryId?: string;

  @ApiPropertyOptional({ enum: TransactionType })
  @IsEnum(TransactionType)
  @IsOptionalButNotNull()
  type?: TransactionType;

  @ApiPropertyOptional({ example: 1920, description: 'Valor absoluto em centavos' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TRANSACTION_AMOUNT_CENTS_MAX)
  @IsOptionalButNotNull()
  amountCents?: number;

  @ApiPropertyOptional({ format: 'date', example: '2026-06-23' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptionalButNotNull()
  date?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: TRANSACTION_DESCRIPTION_MAX_LENGTH })
  @IsString()
  @MaxLength(TRANSACTION_DESCRIPTION_MAX_LENGTH)
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ enum: TransactionDirection })
  @IsEnum(TransactionDirection)
  @IsOptionalButNotNull()
  direction?: TransactionDirection;
}
