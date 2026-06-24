import { CategoryType } from '@/common/models/enums';
import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { Category } from '../entities/category.entity';

export interface ListManagementCategoriesInput {
  userId: string;
  includeArchived: boolean;
  type?: CategoryType;
  search?: string;
  normalizedSearch?: string | null;
  page: number;
  limit: number;
}

export interface ListManagementCategoriesOutput {
  items: Category[];
  total: number;
}

export abstract class ICategoryRepository {
  abstract findByIdAndUserId(
    categoryId: string,
    userId: string,
    options?: IRepositoryOptions,
  ): Promise<Category | null>;
  abstract listByUserId(userId: string, includeArchived: boolean, options?: IRepositoryOptions): Promise<Category[]>;
  abstract listByUserIdAndType(
    userId: string,
    type: CategoryType,
    includeArchived: boolean,
    options?: IRepositoryOptions,
  ): Promise<Category[]>;
  abstract listManagementCategories(
    input: ListManagementCategoriesInput,
    options?: IRepositoryOptions,
  ): Promise<ListManagementCategoriesOutput>;
  abstract findActiveByNameAndType(
    userId: string,
    type: CategoryType,
    name: string,
    options?: IRepositoryOptions,
  ): Promise<Category | null>;
  abstract findActiveSystemByType(
    userId: string,
    type: CategoryType,
    options?: IRepositoryOptions,
  ): Promise<Category | null>;
  abstract existsActiveByNameAndType(
    userId: string,
    type: CategoryType,
    name: string,
    excludeCategoryId?: string,
    options?: IRepositoryOptions,
  ): Promise<boolean>;
  abstract hasTransactions(categoryId: string, userId: string, options?: IRepositoryOptions): Promise<boolean>;
  abstract moveTransactionsToCategory(
    sourceCategoryId: string,
    targetCategoryId: string,
    userId: string,
    options?: IRepositoryOptions,
  ): Promise<void>;
  abstract save(category: Category, options?: IRepositoryOptions): Promise<Category>;
  abstract delete(categoryId: string, userId: string, options?: IRepositoryOptions): Promise<void>;
}
