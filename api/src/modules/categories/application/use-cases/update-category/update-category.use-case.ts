import { getPostgresConstraintName, isPostgresUniqueViolation } from '@/common/utils/database-errors';
import { applyIfDefined } from '@/common/utils/utils';
import {
  UpdateCategoryUseCaseInput,
  UpdateCategoryUseCaseOutput,
} from '@/modules/categories/application/use-cases/update-category/update-category.dto';
import {
  CategoryNameAlreadyExistsError,
  CategoryNotFoundError,
  CategoryNotManageableApplicationError,
  CategoryUpdateEmptyError,
} from '@/modules/categories/application/errors';
import { ICategoryRepository } from '@/modules/categories/domain/repositories/category.repository.interface';
import { Injectable } from '@nestjs/common';

const UNIQUE_ACTIVE_CATEGORY_NAME_CONSTRAINT = 'UQ_categories_user_type_name_not_archived';

@Injectable()
export class UpdateCategoryUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute(data: UpdateCategoryUseCaseInput): Promise<UpdateCategoryUseCaseOutput> {
    const category = await this.categoryRepository.findByIdAndUserId(data.categoryId, data.userId);

    if (!category) {
      throw new CategoryNotFoundError();
    }

    if (!category.isEditable) {
      throw new CategoryNotManageableApplicationError('Only active user-managed categories can be updated.');
    }

    const hasAnyField = Object.values(data.patch).some(value => value !== undefined);

    if (!hasAnyField) {
      throw new CategoryUpdateEmptyError();
    }

    const previousName = category.name;

    applyIfDefined(data.patch.displayName, value => category.rename(value));
    applyIfDefined(data.patch.description, value => category.changeDescription(value));
    applyIfDefined(data.patch.colorToken, value => category.changeColorToken(value));
    applyIfDefined(data.patch.iconKey, value => category.changeIconKey(value));
    applyIfDefined(data.patch.includeInReports, value => category.changeIncludeInReports(value));
    applyIfDefined(data.patch.sortOrder, value => category.changeSortOrder(value));

    if (category.name !== previousName) {
      const alreadyExists = await this.categoryRepository.existsActiveByNameAndType(
        category.userId,
        category.type,
        category.name,
        category.id,
      );

      if (alreadyExists) {
        throw new CategoryNameAlreadyExistsError();
      }
    }

    try {
      return await this.categoryRepository.save(category);
    } catch (error) {
      if (
        isPostgresUniqueViolation(error) &&
        getPostgresConstraintName(error) === UNIQUE_ACTIVE_CATEGORY_NAME_CONSTRAINT
      ) {
        throw new CategoryNameAlreadyExistsError();
      }

      throw error;
    }
  }
}
