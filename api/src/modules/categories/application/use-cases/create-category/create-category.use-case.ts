import { getPostgresConstraintName, isPostgresUniqueViolation } from '@/common/utils/database-errors';
import {
  CreateCategoryUseCaseInput,
  CreateCategoryUseCaseOutput,
} from '@/modules/categories/application/use-cases/create-category/create-category.dto';
import { CategoryNameAlreadyExistsError } from '@/modules/categories/application/errors';
import { CategoryFactory } from '@/modules/categories/domain/factories/category.factory';
import { ICategoryRepository } from '@/modules/categories/domain/repositories/category.repository.interface';
import { Injectable } from '@nestjs/common';

const UNIQUE_ACTIVE_CATEGORY_NAME_CONSTRAINT = 'UQ_categories_user_type_name_not_archived';

@Injectable()
export class CreateCategoryUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute(data: CreateCategoryUseCaseInput): Promise<CreateCategoryUseCaseOutput> {
    const category = CategoryFactory.createManualCategory(data);
    const alreadyExists = await this.categoryRepository.existsActiveByNameAndType(
      category.userId,
      category.type,
      category.name,
    );

    if (alreadyExists) {
      throw new CategoryNameAlreadyExistsError();
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
