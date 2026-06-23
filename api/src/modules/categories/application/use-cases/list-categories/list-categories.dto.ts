import { CategoryType } from '@/common/models/enums';
import { Category } from '@/modules/categories/domain/entities/category.entity';

export interface ListCategoriesUseCaseInput {
  userId: string;
  includeArchived?: boolean;
  type?: CategoryType;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListCategoriesUseCaseOutput {
  items: Category[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
