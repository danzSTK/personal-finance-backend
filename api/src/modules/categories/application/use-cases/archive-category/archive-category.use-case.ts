import { ArchiveCategoryUseCaseInput } from '@/modules/categories/application/use-cases/archive-category/archive-category.dto';
import { CategoryNotFoundError, CategoryNotManageableApplicationError } from '@/modules/categories/application/errors';
import { ICategoryRepository } from '@/modules/categories/domain/repositories/category.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ArchiveCategoryUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute(data: ArchiveCategoryUseCaseInput): Promise<void> {
    const category = await this.categoryRepository.findByIdAndUserId(data.categoryId, data.userId);

    if (!category) {
      throw new CategoryNotFoundError();
    }

    if (!category.canBeManagedByUser) {
      throw new CategoryNotManageableApplicationError('System or technical categories cannot be archived.');
    }

    category.archive();

    await this.categoryRepository.save(category);
  }
}
