import { getPostgresConstraintName, isPostgresUniqueViolation } from '@/common/utils/database-errors';
import {
  ProvisionDefaultCategoriesUseCaseInput,
  ProvisionDefaultCategoriesUseCaseOutput,
} from '@/modules/categories/application/use-cases/provision-default-categories/provision-default-categories.dto';
import { ONBOARDING_CATEGORY_TEMPLATES } from '@/modules/categories/domain/defaults/default-category.templates';
import { CategoryFactory } from '@/modules/categories/domain/factories/category.factory';
import { ICategoryRepository } from '@/modules/categories/domain/repositories/category.repository.interface';
import { Injectable } from '@nestjs/common';

const UNIQUE_ACTIVE_CATEGORY_NAME_CONSTRAINT = 'UQ_categories_user_type_name_not_archived';

@Injectable()
export class ProvisionDefaultCategoriesUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute(data: ProvisionDefaultCategoriesUseCaseInput): Promise<ProvisionDefaultCategoriesUseCaseOutput> {
    let created = 0;
    let skipped = 0;

    for (const template of ONBOARDING_CATEGORY_TEMPLATES) {
      const category = CategoryFactory.createFromDefaultTemplate({
        userId: data.userId,
        template,
      });

      const alreadyExists = await this.categoryRepository.existsActiveByNameAndType(
        category.userId,
        category.type,
        category.name,
      );

      if (alreadyExists) {
        skipped += 1;
        continue;
      }

      try {
        await this.categoryRepository.save(category);
        created += 1;
      } catch (error) {
        if (
          !isPostgresUniqueViolation(error) ||
          getPostgresConstraintName(error) !== UNIQUE_ACTIVE_CATEGORY_NAME_CONSTRAINT
        ) {
          throw error;
        }

        skipped += 1;
      }
    }

    return { created, skipped };
  }
}
