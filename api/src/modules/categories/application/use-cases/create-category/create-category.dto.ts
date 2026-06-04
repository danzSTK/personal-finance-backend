import { CategoryType, ColorToken, IconKey } from '@/common/models/enums';
import { Category } from '@/modules/categories/domain/entities/category.entity';

export interface CreateCategoryUseCaseInput {
  userId: string;
  displayName: string;
  type: CategoryType;
  description?: string | null;
  colorToken?: ColorToken | null;
  iconKey?: IconKey | null;
  includeInReports?: boolean;
  sortOrder?: number;
}

export type CreateCategoryUseCaseOutput = Category;
