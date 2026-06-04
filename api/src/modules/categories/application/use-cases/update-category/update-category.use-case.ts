import { getPostgresConstraintName, isPostgresUniqueViolation } from '@/common/utils/database-errors';
import { applyIfDefined } from '@/common/utils/utils';
import {
  UpdateCategoryUseCaseInput,
  UpdateCategoryUseCaseOutput,
} from '@/modules/categories/application/use-cases/update-category/update-category.dto';
import { ICategoryRepository } from '@/modules/categories/domain/repositories/category.repository.interface';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

const UNIQUE_ACTIVE_CATEGORY_NAME_CONSTRAINT = 'UQ_categories_user_type_name_not_archived';

@Injectable()
export class UpdateCategoryUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute(data: UpdateCategoryUseCaseInput): Promise<UpdateCategoryUseCaseOutput> {
    const category = await this.categoryRepository.findByIdAndUserId(data.categoryId, data.userId);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (!category.isEditable) {
      throw new ConflictException('Only active user-managed categories can be updated');
    }

    const hasAnyField = Object.values(data.patch).some(value => value !== undefined);

    if (!hasAnyField) {
      throw new ConflictException('At least one field must be provided for update');
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
        throw new ConflictException('An active category with this name already exists for this type');
      }
    }

    try {
      return await this.categoryRepository.save(category);
    } catch (error) {
      if (
        isPostgresUniqueViolation(error) &&
        getPostgresConstraintName(error) === UNIQUE_ACTIVE_CATEGORY_NAME_CONSTRAINT
      ) {
        throw new ConflictException('An active category with this name already exists for this type');
      }

      throw error;
    }
  }
}
