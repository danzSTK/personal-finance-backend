import {
  CATEGORY_COLOR_TOKEN_MAX_LENGTH,
  CATEGORY_DESCRIPTION_MAX_LENGTH,
  CATEGORY_DISPLAY_NAME_MAX_LENGTH,
  CATEGORY_DISPLAY_NAME_MIN_LENGTH,
  CATEGORY_ICON_KEY_MAX_LENGTH,
  CATEGORY_SORT_ORDER_MIN,
} from '@/common/models/constants';
import { ColorToken, IconKey } from '@/common/models/enums';
import { IsOptionalButNotNull } from '@/common/decorators/is-optional-but-not-null.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, MaxLength, Min } from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({
    example: 'Alimentação',
    description: 'Novo nome exibido. Recalcula o name canônico usado para unicidade.',
  })
  @IsOptionalButNotNull()
  @IsString()
  @Length(CATEGORY_DISPLAY_NAME_MIN_LENGTH, CATEGORY_DISPLAY_NAME_MAX_LENGTH)
  displayName?: string;

  @ApiPropertyOptional({ example: 'Gastos com mercado, restaurantes e delivery', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(CATEGORY_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiPropertyOptional({
    enum: ColorToken,
    example: ColorToken.GREEN,
    nullable: true,
    description: 'Token oficial de cor; null limpa a seleção visual.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(CATEGORY_COLOR_TOKEN_MAX_LENGTH)
  @IsEnum(ColorToken)
  colorToken?: ColorToken | null;

  @ApiPropertyOptional({
    enum: IconKey,
    example: IconKey.SHOPPING_CART,
    nullable: true,
    description: 'Token oficial de ícone; null limpa a seleção visual.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(CATEGORY_ICON_KEY_MAX_LENGTH)
  @IsEnum(IconKey)
  iconKey?: IconKey | null;

  @ApiPropertyOptional({ example: true, description: 'Controla inclusão em relatórios agregados' })
  @IsOptionalButNotNull()
  @Type(() => Boolean)
  @IsBoolean()
  includeInReports?: boolean;

  @ApiPropertyOptional({ example: 0, description: 'Ordem de exibição na tela de categorias' })
  @IsOptionalButNotNull()
  @Type(() => Number)
  @IsInt()
  @Min(CATEGORY_SORT_ORDER_MIN)
  sortOrder?: number;
}
