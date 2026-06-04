import { ApiProperty } from '@nestjs/swagger';
import { CategoryType, ColorToken, IconKey } from '@/common/models/enums';
import { Category } from '@/modules/categories/domain/entities/category.entity';

export class CategoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    description: 'Nome canônico usado para busca e unicidade. Não é o texto exibido ao usuário.',
    example: 'alimentacao',
  })
  name: string;

  @ApiProperty({ description: 'Nome exibido na interface', example: 'Alimentação' })
  displayName: string;

  @ApiProperty({ nullable: true, example: 'Gastos com mercado, restaurantes e delivery' })
  description: string | null;

  @ApiProperty({ enum: CategoryType, example: CategoryType.EXPENSE })
  type: CategoryType;

  @ApiProperty({ enum: ColorToken, nullable: true, example: ColorToken.EMERALD })
  colorToken: ColorToken | null;

  @ApiProperty({ enum: IconKey, nullable: true, example: IconKey.UTENSILS })
  iconKey: IconKey | null;

  @ApiProperty({
    description: 'Indica categoria estrutural do sistema, não apenas categoria criada automaticamente',
    example: false,
  })
  isSystem: boolean;

  @ApiProperty({ description: 'Indica se categorias manuais entram em relatórios agregados', example: true })
  includeInReports: boolean;

  @ApiProperty({ example: false })
  isArchived: boolean;

  @ApiProperty({ format: 'date-time', nullable: true })
  archivedAt: Date | null;

  @ApiProperty({ example: 0 })
  sortOrder: number;

  @ApiProperty({ description: 'Indica se a categoria pode ser editada pelo usuário neste estado', example: true })
  isEditable: boolean;

  @ApiProperty({
    description: 'Indica se a categoria deve aparecer nas telas comuns de gerenciamento',
    example: true,
  })
  isVisibleInManagement: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;

  static fromDomain(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      displayName: category.displayName,
      description: category.description,
      type: category.type,
      colorToken: category.colorToken,
      iconKey: category.iconKey,
      isSystem: category.isSystem,
      includeInReports: category.includeInReports,
      isArchived: category.isArchived,
      archivedAt: category.archivedAt,
      sortOrder: category.sortOrder,
      isEditable: category.isEditable,
      isVisibleInManagement: category.isVisibleInManagement,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
