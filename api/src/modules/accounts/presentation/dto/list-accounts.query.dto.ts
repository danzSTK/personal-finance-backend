import { IsDateOnly } from '@/common/decorators/is-date-only.decorator';
import type { DateOnlyString } from '@/common/utils/date-only';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class ListAccountsQueryDto {
  @ApiPropertyOptional({
    description: 'Quando true, inclui contas arquivadas na listagem',
    example: false,
    default: false,
  })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  includeArchived?: boolean;

  @ApiPropertyOptional({
    description: 'Quando informado, retorna balance.projectedCents calculado até esta data',
    example: '2026-06-30',
    format: 'date',
  })
  @IsDateOnly()
  @IsOptional()
  projectedUntil?: DateOnlyString;
}
