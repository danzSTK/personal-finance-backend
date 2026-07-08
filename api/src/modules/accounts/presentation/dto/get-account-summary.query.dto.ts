import { IsDateOnly } from '@/common/decorators/is-date-only.decorator';
import { parseBooleanTransformValue } from '@/common/utils/parse-boolean-query-param';
import type { DateOnlyString } from '@/common/utils/date-only';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class GetAccountSummaryQueryDto {
  @ApiPropertyOptional({
    description: 'Quando informado, retorna projectedCents calculado até esta data',
    example: '2026-06-30',
    format: 'date',
  })
  @IsDateOnly()
  @IsOptional()
  projectedUntil?: DateOnlyString;

  @ApiPropertyOptional({
    description: 'Quando true, inclui contas arquivadas no saldo agregado',
    example: false,
    default: false,
  })
  @Transform(parseBooleanTransformValue)
  @IsBoolean()
  @IsOptional()
  includeArchived?: boolean;

  @ApiPropertyOptional({
    description: 'Quando true, inclui contas com includeInTotal=false no saldo agregado',
    example: false,
    default: false,
  })
  @Transform(parseBooleanTransformValue)
  @IsBoolean()
  @IsOptional()
  includeExcludedFromTotal?: boolean;
}
