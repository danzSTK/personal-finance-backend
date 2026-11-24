import { IsDateOnly } from '@/common/decorators/is-date-only.decorator';
import {
  TRANSACTION_DESCRIPTION_MAX_LENGTH,
  TRANSACTION_TARGET_BALANCE_CENTS_MAX,
  TRANSACTION_TARGET_BALANCE_CENTS_MIN,
} from '@/common/models/constants';
import type { DateOnlyString } from '@/common/utils/date-only';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

function preserveRawNumberValue({ obj, key, value }: TransformFnParams): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }

  return value;
}

export class CreateBalanceAdjustmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  accountId: string;

  @ApiProperty({
    example: 100000,
    description: 'Saldo alvo desejado da conta em centavos (aceita valores negativos, zero ou positivos)',
  })
  @Transform(preserveRawNumberValue)
  @IsInt()
  @Min(TRANSACTION_TARGET_BALANCE_CENTS_MIN)
  @Max(TRANSACTION_TARGET_BALANCE_CENTS_MAX)
  targetBalanceCents: number;

  @ApiProperty({ format: 'date', example: '2026-06-23' })
  @IsDateOnly()
  date: DateOnlyString;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: TRANSACTION_DESCRIPTION_MAX_LENGTH,
    example: 'Conciliação com extrato bancário',
    description: 'Motivo opcional do reajuste. Quando omitido ou vazio, utiliza "Reajuste de saldo".',
  })
  @IsString()
  @MaxLength(TRANSACTION_DESCRIPTION_MAX_LENGTH)
  @IsOptional()
  description?: string | null;
}
