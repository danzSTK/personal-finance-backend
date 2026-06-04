import { ColorToken, IconKey } from '@/common/models/enums';
import { Category } from '@/modules/categories/domain/entities/category.entity';

export interface UpdateCategoryPatch {
  displayName?: string;
  description?: string | null;
  colorToken?: ColorToken | null;
  iconKey?: IconKey | null;
  includeInReports?: boolean;
  sortOrder?: number;
}

export interface UpdateCategoryUseCaseInput {
  userId: string;
  categoryId: string;
  patch: UpdateCategoryPatch;
}

export type UpdateCategoryUseCaseOutput = Category;
