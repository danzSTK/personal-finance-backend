import { DeleteCategoryUseCaseInput } from '@/modules/categories/application/use-cases/delete-category/delete-category.dto';
import {
  CategoryHasTransactionsError,
  CategoryNotFoundError,
  CategoryNotManageableApplicationError,
} from '@/modules/categories/application/errors';
import { ICategoryRepository } from '@/modules/categories/domain/repositories/category.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DeleteCategoryUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute(data: DeleteCategoryUseCaseInput): Promise<void> {
    const category = await this.categoryRepository.findByIdAndUserId(data.categoryId, data.userId);

    if (!category) {
      throw new CategoryNotFoundError();
    }

    if (!category.canBeManagedByUser) {
      throw new CategoryNotManageableApplicationError('System or technical categories cannot be deleted.');
    }

    const hasTransactions = await this.categoryRepository.hasTransactions(category.id, category.userId);

    if (hasTransactions) {
      throw new CategoryHasTransactionsError();
    }

    await this.categoryRepository.delete(category.id, category.userId);
  }
}
