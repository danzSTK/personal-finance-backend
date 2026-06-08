import { getPostgresConstraintName, isPostgresUniqueViolation } from '@/common/utils/database-errors';
import { UnarchiveCategoryUseCaseInput } from '@/modules/categories/application/use-cases/unarchive-category/unarchive-category.dto';
import {
  CategoryNameAlreadyExistsError,
  CategoryNotFoundError,
  CategoryNotManageableApplicationError,
} from '@/modules/categories/application/errors';
import { ICategoryRepository } from '@/modules/categories/domain/repositories/category.repository.interface';
import { Injectable } from '@nestjs/common';

const UNIQUE_ACTIVE_CATEGORY_NAME_CONSTRAINT = 'UQ_categories_user_type_name_not_archived';

@Injectable()
export class UnarchiveCategoryUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute(data: UnarchiveCategoryUseCaseInput): Promise<void> {
    const category = await this.categoryRepository.findByIdAndUserId(data.categoryId, data.userId);

    if (!category) {
      throw new CategoryNotFoundError();
    }

    if (!category.canBeManagedByUser) {
      throw new CategoryNotManageableApplicationError('System or technical categories cannot be unarchived.');
    }

    if (category.isArchived) {
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

    category.unarchive();

    try {
      await this.categoryRepository.save(category);
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
