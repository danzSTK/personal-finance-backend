import {
  CATEGORY_COLOR_TOKEN_MAX_LENGTH,
  CATEGORY_DESCRIPTION_MAX_LENGTH,
  CATEGORY_DISPLAY_NAME_MAX_LENGTH,
  CATEGORY_DISPLAY_NAME_MIN_LENGTH,
  CATEGORY_ICON_KEY_MAX_LENGTH,
  CATEGORY_SORT_ORDER_MIN,
} from '@/common/models/constants';
import { CategoryType, ColorToken, IconKey } from '@/common/models/enums';
import { IsOptionalButNotNull } from '@/common/decorators/is-optional-but-not-null.decorator';
import { parseBooleanTransformValue } from '@/common/utils/parse-boolean-query-param';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Alimentação',
    description: 'Nome exibido ao usuário. O backend gera um name canônico a partir deste valor.',
  })
  @IsString()
  @IsNotEmpty()
  @Length(CATEGORY_DISPLAY_NAME_MIN_LENGTH, CATEGORY_DISPLAY_NAME_MAX_LENGTH)
  displayName: string;

  @ApiProperty({
    enum: [CategoryType.INCOME, CategoryType.EXPENSE, CategoryType.INVESTMENT],
    example: CategoryType.EXPENSE,
    description: 'Tipo gerenciável criado manualmente. TRANSFER e ADJUSTMENT são reservados ao sistema.',
  })
  @IsIn([CategoryType.INCOME, CategoryType.EXPENSE, CategoryType.INVESTMENT])
  type: CategoryType;

  @ApiPropertyOptional({ example: 'Gastos com mercado, restaurantes e delivery', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(CATEGORY_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiPropertyOptional({
    enum: ColorToken,
    example: ColorToken.EMERALD,
    nullable: true,
    description: 'Token oficial de cor permitido pelo backend. Use GET /categories/metadata para obter o catálogo.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(CATEGORY_COLOR_TOKEN_MAX_LENGTH)
  @IsEnum(ColorToken)
  colorToken?: ColorToken | null;

  @ApiPropertyOptional({
    enum: IconKey,
    example: IconKey.UTENSILS,
    nullable: true,
    description: 'Token oficial de ícone permitido pelo backend. Use GET /categories/metadata para obter o catálogo.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(CATEGORY_ICON_KEY_MAX_LENGTH)
  @IsEnum(IconKey)
  iconKey?: IconKey | null;

  @ApiPropertyOptional({ example: true, default: true, description: 'Controla inclusão em relatórios agregados' })
  @IsOptionalButNotNull()
  @Transform(parseBooleanTransformValue)
  @IsBoolean()
  includeInReports?: boolean;

  @ApiPropertyOptional({ example: 0, default: 0, description: 'Ordem de exibição na tela de categorias' })
  @IsOptionalButNotNull()
  @Type(() => Number)
  @IsInt()
  @Min(CATEGORY_SORT_ORDER_MIN)
  sortOrder?: number;
}
