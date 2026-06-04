import { Category } from '@/modules/categories/domain/entities/category.entity';

export interface GetCategoryUseCaseInput {
  userId: string;
  categoryId: string;
}

export type GetCategoryUseCaseOutput = Category;
