import { ArchiveCategoryUseCaseInput } from '@/modules/categories/application/use-cases/archive-category/archive-category.dto';
import { ICategoryRepository } from '@/modules/categories/domain/repositories/category.repository.interface';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class ArchiveCategoryUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute(data: ArchiveCategoryUseCaseInput): Promise<void> {
    const category = await this.categoryRepository.findByIdAndUserId(data.categoryId, data.userId);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (!category.canBeManagedByUser) {
      throw new ConflictException('System or technical categories cannot be archived');
    }

    category.archive();

    await this.categoryRepository.save(category);
  }
}
