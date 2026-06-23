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
}
