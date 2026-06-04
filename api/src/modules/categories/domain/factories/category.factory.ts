import { DefaultCategoryTemplate } from '@/modules/categories/domain/defaults/default-category.templates';
import { Category, CreateCategoryProps } from '@/modules/categories/domain/entities/category.entity';
import { randomUUID } from 'node:crypto';

type CreateManualCategoryInput = Omit<CreateCategoryProps, 'isSystem'>;
type CreateTemplateCategoryInput = {
  userId: string;
  template: DefaultCategoryTemplate;
};

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

  static createFromDefaultTemplate(data: CreateTemplateCategoryInput): Category {
    const { template } = data;

    return Category.create(
      {
        userId: data.userId,
        displayName: template.displayName,
        type: template.type,
        colorToken: template.colorToken,
        iconKey: template.iconKey,
        isSystem: template.isSystem,
        includeInReports: template.includeInReports,
        sortOrder: template.sortOrder,
      },
      randomUUID(),
    );
  }
}
