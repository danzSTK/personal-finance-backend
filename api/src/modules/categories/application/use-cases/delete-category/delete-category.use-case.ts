import { DeleteCategoryUseCaseInput } from '@/modules/categories/application/use-cases/delete-category/delete-category.dto';
import { ICategoryRepository } from '@/modules/categories/domain/repositories/category.repository.interface';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class DeleteCategoryUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute(data: DeleteCategoryUseCaseInput): Promise<void> {
    const category = await this.categoryRepository.findByIdAndUserId(data.categoryId, data.userId);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (!category.canBeManagedByUser) {
      throw new ConflictException('System or technical categories cannot be deleted');
    }

    const hasTransactions = await this.categoryRepository.hasTransactions(category.id, category.userId);

    if (hasTransactions) {
      throw new ConflictException('Category has transactions and must be merged before deletion');
    }

    await this.categoryRepository.delete(category.id, category.userId);
  }
}
