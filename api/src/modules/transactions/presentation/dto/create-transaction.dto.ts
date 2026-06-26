import { IsDateOnly } from '@/common/decorators/is-date-only.decorator';
import { TRANSACTION_AMOUNT_CENTS_MAX, TRANSACTION_DESCRIPTION_MAX_LENGTH } from '@/common/models/constants';
import { TransactionDirection, TransactionStatus, TransactionType } from '@/common/models/enums';
import type { DateOnlyString } from '@/common/utils/date-only';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Obrigatório quando type = TRANSFER' })
  @IsUUID()
  @IsOptional()
  destinationAccountId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Obrigatório para INCOME/EXPENSE. Ignorado para TRANSFER/ADJUSTMENT, que usam categoria técnica.',
  })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiPropertyOptional({ enum: TransactionStatus, default: TransactionStatus.EFFECTIVE })
  @IsEnum(TransactionStatus)
  @IsOptional()
  status?: TransactionStatus;

  @ApiProperty({ example: 1920, description: 'Valor absoluto em centavos' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TRANSACTION_AMOUNT_CENTS_MAX)
  amountCents: number;

  @ApiProperty({ format: 'date', example: '2026-06-23' })
  @IsDateOnly()
  date: DateOnlyString;

  @ApiPropertyOptional({ nullable: true, maxLength: TRANSACTION_DESCRIPTION_MAX_LENGTH })
  @IsString()
  @MaxLength(TRANSACTION_DESCRIPTION_MAX_LENGTH)
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ enum: TransactionDirection, description: 'Obrigatório quando type = ADJUSTMENT' })
  @IsEnum(TransactionDirection)
  @IsOptional()
  direction?: TransactionDirection;
}
