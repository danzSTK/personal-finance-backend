import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, Matches } from 'class-validator';

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
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  projectedUntil?: string;
}
