import { Category, CreateCategoryProps } from '@/modules/categories/domain/entities/category.entity';
import { randomUUID } from 'node:crypto';

type CreateManualCategoryInput = Omit<CreateCategoryProps, 'isSystem'>;

export class CategoryFactory {
  static createManualCategory(data: CreateManualCategoryInput): Category {
    if (!Category.canBeCreatedManually(data.type)) {
      throw new Error('Technical category types cannot be created manually.');
    }

    return Category.create(
      {
        ...data,
        isSystem: false,
      },
      randomUUID(),
    );
  }
}
