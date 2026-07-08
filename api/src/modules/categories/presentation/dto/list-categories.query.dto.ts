import {
  CATEGORY_LIST_DEFAULT_LIMIT,
  CATEGORY_LIST_DEFAULT_PAGE,
  CATEGORY_LIST_MAX_LIMIT,
  CATEGORY_SEARCH_MAX_LENGTH,
} from '@/common/models/constants';
import { CategoryType } from '@/common/models/enums';
import { parseBooleanTransformValue } from '@/common/utils/parse-boolean-query-param';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const MANAGEMENT_CATEGORY_TYPES = [CategoryType.INCOME, CategoryType.EXPENSE, CategoryType.INVESTMENT] as const;

export class ListCategoriesQueryDto {
  @ApiPropertyOptional({
    description: 'Quando true, inclui categorias arquivadas na listagem',
    example: false,
    default: false,
  })
  @Transform(parseBooleanTransformValue)
  @IsBoolean()
  @IsOptional()
  includeArchived?: boolean;

  @ApiPropertyOptional({
    enum: MANAGEMENT_CATEGORY_TYPES,
    example: CategoryType.EXPENSE,
    description: 'Filtra por tipo gerenciável. TRANSFER e ADJUSTMENT não são retornados por esta rota.',
  })
  @IsIn(MANAGEMENT_CATEGORY_TYPES)
  @IsOptional()
  type?: CategoryType;

  @ApiPropertyOptional({
    example: 'alimentação',
    description: 'Busca por displayName e também pelo name canônico gerado pelo backend',
  })
  @IsString()
  @MaxLength(CATEGORY_SEARCH_MAX_LENGTH)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ example: CATEGORY_LIST_DEFAULT_PAGE, default: CATEGORY_LIST_DEFAULT_PAGE })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: CATEGORY_LIST_DEFAULT_LIMIT, default: CATEGORY_LIST_DEFAULT_LIMIT })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CATEGORY_LIST_MAX_LIMIT)
  @IsOptional()
  limit?: number;
}
