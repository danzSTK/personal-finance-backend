import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, NotEquals } from 'class-validator';

export class DeleteCategoryWithMergeDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Categoria ativa e gerenciável que receberá todas as transações da categoria removida',
  })
  @IsUUID()
  @NotEquals(null)
  targetCategoryId: string;
}
