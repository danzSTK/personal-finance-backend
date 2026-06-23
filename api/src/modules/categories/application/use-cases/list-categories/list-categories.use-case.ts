import {
  CATEGORY_LIST_DEFAULT_LIMIT,
  CATEGORY_LIST_DEFAULT_PAGE,
  CATEGORY_LIST_MAX_LIMIT,
} from '@/common/models/constants';
import {
  ListCategoriesUseCaseInput,
  ListCategoriesUseCaseOutput,
} from '@/modules/categories/application/use-cases/list-categories/list-categories.dto';
import { CategoryInvalidListQueryError } from '@/modules/categories/application/errors';
import { Category } from '@/modules/categories/domain/entities/category.entity';
import { ICategoryRepository } from '@/modules/categories/domain/repositories/category.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ListCategoriesUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute(data: ListCategoriesUseCaseInput): Promise<ListCategoriesUseCaseOutput> {
    if (data.type && Category.isTechnicalType(data.type)) {
      throw new CategoryInvalidListQueryError('Technical categories are not available in category management.');
    }

    const page = data.page ?? CATEGORY_LIST_DEFAULT_PAGE;
    const limit = data.limit ?? CATEGORY_LIST_DEFAULT_LIMIT;

    if (!Number.isInteger(page) || page < 1) {
      throw new CategoryInvalidListQueryError('Page must be a positive integer.');
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > CATEGORY_LIST_MAX_LIMIT) {
      throw new CategoryInvalidListQueryError(`Limit must be between 1 and ${CATEGORY_LIST_MAX_LIMIT}.`);
    }

    const search = data.search?.trim() || undefined;
    const { items, total } = await this.categoryRepository.listManagementCategories({
      userId: data.userId,
      includeArchived: data.includeArchived ?? false,
      type: data.type,
      search,
      normalizedSearch: search ? Category.normalizeNameForSearch(search) : null,
      page,
      limit,
    });
    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}
