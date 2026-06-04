import { Category } from '@/modules/categories/domain/entities/category.entity';
import { CategoryOrmEntity } from '@/modules/categories/infrastructure/persistence/model/category.entity';

export class CategoryMapper {
  static toDomain(entity: CategoryOrmEntity): Category {
    return Category.reconstitute(
      {
        userId: entity.user_id,
        name: entity.name,
        displayName: entity.display_name,
        description: entity.description,
        type: entity.type,
        colorToken: entity.color_token,
        iconKey: entity.icon_key,
        isSystem: entity.is_system,
        includeInReports: entity.include_in_reports,
        isArchived: entity.is_archived,
        archivedAt: entity.archived_at,
        sortOrder: entity.sort_order,
        createdAt: entity.created_at,
        updatedAt: entity.updated_at,
      },
      entity.id,
    );
  }

  static toOrm(category: Category): Partial<CategoryOrmEntity> {
    return {
      id: category.id,
      user_id: category.userId,
      name: category.name,
      display_name: category.displayName,
      description: category.description,
      type: category.type,
      color_token: category.colorToken,
      icon_key: category.iconKey,
      is_system: category.isSystem,
      include_in_reports: category.includeInReports,
      is_archived: category.isArchived,
      archived_at: category.archivedAt,
      sort_order: category.sortOrder,
      created_at: category.createdAt,
      updated_at: category.updatedAt,
    };
  }
}
