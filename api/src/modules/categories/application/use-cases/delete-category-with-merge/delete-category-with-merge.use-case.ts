import { DeleteCategoryWithMergeUseCaseInput } from '@/modules/categories/application/use-cases/delete-category-with-merge/delete-category-with-merge.dto';
import { ICategoryRepository } from '@/modules/categories/domain/repositories/category.repository.interface';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class DeleteCategoryWithMergeUseCase {
  constructor(
    private readonly categoryRepository: ICategoryRepository,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async execute(data: DeleteCategoryWithMergeUseCaseInput): Promise<void> {
    await this.dataSource.transaction(manager => this.executeWithManager(data, manager));
  }

  private async executeWithManager(data: DeleteCategoryWithMergeUseCaseInput, manager: EntityManager): Promise<void> {
    if (data.categoryId === data.targetCategoryId) {
      throw new ConflictException('Target category must be different from source category');
    }

    const [sourceCategory, targetCategory] = await Promise.all([
      this.categoryRepository.findByIdAndUserId(data.categoryId, data.userId, { manager }),
      this.categoryRepository.findByIdAndUserId(data.targetCategoryId, data.userId, { manager }),
    ]);

    if (!sourceCategory || !sourceCategory.canBeManagedByUser) {
      throw new NotFoundException('Category not found');
    }

    if (!targetCategory || !targetCategory.canBeManagedByUser || targetCategory.isArchived) {
      throw new ConflictException('Target category must be an active user-managed category');
    }

    if (sourceCategory.type !== targetCategory.type) {
      throw new ConflictException('Target category must have the same type as source category');
    }

    await this.categoryRepository.moveTransactionsToCategory(sourceCategory.id, targetCategory.id, data.userId, {
      manager,
    });
    await this.categoryRepository.delete(sourceCategory.id, sourceCategory.userId, { manager });
  }
}
